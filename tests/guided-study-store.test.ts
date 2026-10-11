import { afterEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { createClient } from "@redis/client";
import {
  BUDGET_KEY,
  OWNER_KEY,
  STUDY_REDIS_URL,
  studyStore,
} from "../eval/guided-study/store";
import { digest } from "../eval/guided-study/ledger";
import { responseReceipt } from "../eval/guided-study/response-receipt";
import { CLAIM_SCRIPT } from "../src/lib/ai/controls";
import { ATTEMPT_SCRIPT } from "../src/lib/ai/request-controls";

afterEach(() => vi.unstubAllEnvs());
it("keeps only structured tool choices and editorial aliases, excluding reasoning and errors", () => {
  const receipt = responseReceipt({
    error: { message: "secret" },
    output: [
      { type: "reasoning", summary: "private reasoning" },
      {
        type: "function_call",
        name: "inspect_match_evidence",
        arguments: JSON.stringify({
          tool: "inspect_counter_evidence",
          matchId: "fixture",
          start: 100,
          end: 200,
          team: null,
          playerId: null,
          eventId: null,
        }),
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              decision: "publish",
              stories: [
                { claimId: "c1", form: "detail", emphasis: "comparison" },
              ],
            }),
          },
        ],
      },
      {
        type: "message",
        content: [{ type: "output_text", text: "secret raw error" }],
      },
    ],
  });
  expect(receipt.toolChoices[0].tool).toBe("inspect_counter_evidence");
  expect(receipt.plans[0]).toMatchObject({ stories: [{ claimId: "c1" }] });
  expect(receipt.invalidStructuredItems).toBe(1);
  expect(JSON.stringify(receipt)).not.toMatch(/secret|reasoning/);
});

// A dedicated, disposable test container; NEVER use the study server, existing
// REDIS_TEST_URL or an application's Redis for destructive corruption tests.
it.skipIf(process.env.FOUNDRY_STUDY_REDIS_TEST !== "1")(
  "fresh allowance survives restart, refuses replacement/rerun/corruption and respects actual application quotas",
  async () => {
    const name = `second-look-guided-test-${process.pid}`;
    const docker = (...args: string[]) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      }).trim();
    let client: ReturnType<typeof createClient> | undefined;
    try {
      docker(
        "run",
        "-d",
        "--name",
        name,
        "-p",
        "127.0.0.1::6379",
        "redis:7.4",
        "redis-server",
        "--appendonly",
        "yes",
        "--appendfsync",
        "always",
        "--save",
        "",
        "--maxmemory-policy",
        "noeviction",
      );
      const address = docker("port", name, "6379/tcp");
      let url = `redis://${address}`;
      expect(url).not.toBe(STUDY_REDIS_URL);
      await vi.waitFor(
        async () => {
          const c = createClient({ url, socket: { reconnectStrategy: false } });
          c.on("error", () => {});
          try {
            await c.connect();
            expect(await c.ping()).toBe("PONG");
          } finally {
            if (c.isOpen) c.destroy();
          }
        },
        { timeout: 5000 },
      );
      await expect(studyStore("inspect", undefined, url)).rejects.toThrow();
      const fresh = await studyStore("initialize", undefined, url);
      expect(fresh.budget.used4).toBe("0");
      expect(fresh.budget.attemptUsed3).toBe("0");
      await expect(studyStore("initialize", undefined, url)).rejects.toThrow(
        /Fresh empty/,
      );
      const claimed = await studyStore("claim", digest("candidate"), url);
      docker("restart", name);
      url = `redis://${docker("port", name, "6379/tcp")}`;
      const restored = await vi.waitFor(
        () => studyStore("inspect", undefined, url),
        { timeout: 5000 },
      );
      expect(restored.budget).toEqual(claimed.budget);
      expect(restored.owner).toEqual(claimed.owner);
      await expect(
        studyStore("claim", digest("different candidate"), url),
      ).rejects.toThrow(/already claimed/);
      client = createClient({ url, socket: { reconnectStrategy: false } });
      client.on("error", () => {});
      await client.connect();
      const workflows = ["test-cache", "test-lock", BUDGET_KEY];
      expect(
        await client.eval(CLAIM_SCRIPT, {
          keys: workflows,
          arguments: ["2", "12", "12", "12", "owner"],
        }),
      ).toEqual(["acquired"]);
      const attempts = ["test-times", "test-tokens", "test-pacing", BUDGET_KEY];
      expect(
        await client.eval(ATTEMPT_SCRIPT, {
          keys: attempts,
          arguments: ["30", "30000", "100", "12", "12", "12", "attempt"],
        }),
      ).toEqual(["acquired"]);
      const used = await studyStore("inspect", undefined, url);
      expect(used.budget.used4).toBe("1");
      expect(used.budget.attemptUsed3).toBe("1");
      client.destroy();
      client = undefined;
      docker("restart", name);
      url = `redis://${docker("port", name, "6379/tcp")}`;
      expect(
        (
          await vi.waitFor(() => studyStore("inspect", undefined, url), {
            timeout: 5000,
          })
        ).budget,
      ).toEqual(used.budget);
      client = createClient({ url });
      client.on("error", () => {});
      await client.connect();
      // Synthetic exhaustion/corruption in this test container only.
      await client.hSet(BUDGET_KEY, { used4: "12", attemptUsed3: "12" });
      expect(
        await client.eval(CLAIM_SCRIPT, {
          keys: ["other-cache", "other-lock", BUDGET_KEY],
          arguments: ["2", "12", "12", "12", "owner"],
        }),
      ).toEqual(["limited"]);
      expect(
        await client.eval(ATTEMPT_SCRIPT, {
          keys: attempts,
          arguments: ["30", "30000", "100", "12", "12", "12", "other"],
        }),
      ).toEqual(["budget"]);
      await expect(studyStore("initialize", undefined, url)).rejects.toThrow();
      await client.hSet(BUDGET_KEY, "attemptUsed3", "corrupt");
      await expect(studyStore("inspect", undefined, url)).rejects.toThrow(
        /Corrupt/,
      );
      await client.hDel(BUDGET_KEY, "used4");
      await expect(studyStore("inspect", undefined, url)).rejects.toThrow(
        /Incomplete/,
      );
      await expect(studyStore("initialize", undefined, url)).rejects.toThrow();
      await client.del(BUDGET_KEY);
      expect(await client.exists(OWNER_KEY)).toBe(1);
      await expect(studyStore("inspect", undefined, url)).rejects.toThrow();
      await expect(studyStore("initialize", undefined, url)).rejects.toThrow();
    } finally {
      if (client?.isOpen) client.destroy();
      try {
        docker("rm", "-f", "-v", name);
      } catch {
        /* Only this test's own container. */
      }
    }
  },
  60000,
);
