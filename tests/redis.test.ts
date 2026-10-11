import { afterAll, expect, it, vi } from "vitest";
import { createClient } from "@redis/client";
import { randomUUID } from "node:crypto";
import { CLAIM_SCRIPT, FINISH_SCRIPT } from "../src/lib/ai/controls";
import {
  ATTEMPT_SCRIPT,
  COOLDOWN_SCRIPT,
} from "../src/lib/ai/request-controls";
const url = process.env.REDIS_TEST_URL;
it.skipIf(!url)(
  "real Redis atomically enforces shared quotas, locks, cache and cooldown across clients",
  async () => {
    const a = await createClient({ url }).connect();
    const b = await createClient({ url }).connect();
    const prefix = `{second-look-test-${randomUUID()}}`;
    const budget = `${prefix}:budget`;
    const keys = (id: string) => [
      `${prefix}:cache:${id}`,
      `${prefix}:lock:${id}`,
      budget,
    ];
    const args = ["2", "2", "2", "2", "owner"];
    try {
      const outcomes = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 ? a : b).eval(CLAIM_SCRIPT, {
            keys: keys(String(i)),
            arguments: args,
          }),
        ),
      );
      expect(
        outcomes.filter((r) => (r as string[])[0] === "acquired"),
      ).toHaveLength(2);
      expect(await a.hGet(budget, "used4")).toBe("2");
      const acquired = outcomes.findIndex(
        (r) => (r as string[])[0] === "acquired",
      );
      const key = keys(String(acquired));
      expect(
        await b.eval(CLAIM_SCRIPT, { keys: key, arguments: args }),
      ).toEqual(["busy"]);
      expect(
        await b.eval(FINISH_SCRIPT, {
          keys: key,
          arguments: ["wrong-owner", "fake"],
        }),
      ).toBe(0);
      await a.eval(FINISH_SCRIPT, {
        keys: key,
        arguments: ["owner", "verified"],
      });
      expect(
        await b.eval(CLAIM_SCRIPT, { keys: key, arguments: args }),
      ).toEqual(["cached", "verified"]);
      const other = outcomes.findIndex(
        (r, i) => i !== acquired && (r as string[])[0] === "acquired",
      );
      await a.eval(FINISH_SCRIPT, {
        keys: keys(String(other)),
        arguments: ["owner", ""],
      });
      expect(await b.ttl(keys(String(other))[1])).toBeLessThanOrEqual(5);
      expect(await b.hGet(budget, "used4")).toBe("2");
    } finally {
      await a.del([
        budget,
        ...Array.from({ length: 10 }, (_, i) =>
          keys(String(i)).slice(0, 2),
        ).flat(),
      ]);
      a.destroy();
      b.destroy();
    }
  },
);
afterAll(() => vi.unstubAllEnvs());

it.skipIf(!url).each([
  { rpm: 10, tpm: 10000, firstTokens: 6000, nextTokens: 5000 },
  { rpm: 30, tpm: 30000, firstTokens: 18000, nextTokens: 15000 },
])(
  "real Redis coordinates pacing, rolling tokens, cooldowns and durable budgets at $tpm TPM across instances",
  async ({ rpm, tpm, firstTokens, nextTokens }) => {
    const a = await createClient({ url }).connect(),
      b = await createClient({ url }).connect();
    const prefix = `{second-look-attempt-test-${randomUUID()}}`;
    const keys = ["times", "tokens", "pacing", "budget"].map(
      (key) => `${prefix}:${key}`,
    );
    const args = (id: string, tokens = firstTokens) => [
      String(rpm),
      String(tpm),
      String(tokens),
      "30",
      "60",
      "100",
      id,
    ];
    try {
      await a.hSet(keys[3], "used4", "7"); // Existing workflow accounting survives.
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 ? a : b).eval(ATTEMPT_SCRIPT, {
            keys,
            arguments: args(String(i)),
          }),
        ),
      );
      expect(
        results.filter((r) => (r as string[])[0] === "acquired"),
      ).toHaveLength(1);
      expect(results.filter((r) => (r as string[])[0] === "wait")).toHaveLength(
        9,
      );
      expect(await b.hGet(keys[3], "attemptUsed3")).toBe("1");
      expect(await b.hGet(keys[3], "used4")).toBe("7");
      await a.hSet(keys[2], "nextAt", "0");
      const waitForTokens = (await b.eval(ATTEMPT_SCRIPT, {
        keys,
        arguments: args("next", nextTokens),
      })) as string[];
      expect(waitForTokens[0]).toBe("wait");
      expect(Number(waitForTokens[1])).toBeGreaterThan(59000);
      // Age only the rolling reservation. Durable charged attempts must survive.
      const id = String(
        results.findIndex((r) => (r as string[])[0] === "acquired"),
      );
      await a.zAdd(keys[0], { score: 0, value: id });
      expect(
        await b.eval(ATTEMPT_SCRIPT, {
          keys,
          arguments: args("next", nextTokens),
        }),
      ).toEqual(["acquired"]);
      expect(await b.hGet(keys[3], "attemptUsed3")).toBe("2");
      await a.eval(COOLDOWN_SCRIPT, { keys: [keys[2]], arguments: ["25000"] });
      await b.eval(COOLDOWN_SCRIPT, { keys: [keys[2]], arguments: ["1000"] });
      const cooldown = (await a.eval(ATTEMPT_SCRIPT, {
        keys,
        arguments: args("cooldown", 2000),
      })) as string[];
      expect(cooldown[0]).toBe("wait");
      expect(Number(cooldown[1])).toBeGreaterThan(24000);
      await a.hSet(keys[3], "attemptUsed3", "100");
      expect(
        await b.eval(ATTEMPT_SCRIPT, { keys, arguments: args("limited") }),
      ).toEqual(["budget"]);
      await a.hSet(keys[3], "attemptUsed3", "2");
      await a.hDel(keys[1], "next");
      expect(
        await b.eval(ATTEMPT_SCRIPT, { keys, arguments: args("corrupt") }),
      ).toEqual(["controls"]);
      expect(await a.hGet(keys[3], "attemptUsed3")).toBe("2");
    } finally {
      await a.del(keys);
      a.destroy();
      b.destroy();
    }
  },
);
