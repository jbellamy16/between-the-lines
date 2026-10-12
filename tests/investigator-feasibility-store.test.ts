import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "@redis/client";
import { randomUUID } from "node:crypto";
import {
  STORE_SCRIPT,
  checkDurability,
} from "../eval/investigator-feasibility/store";
const url = process.env.REDIS_TEST_URL;
// Only the ordinary CI test service, never a campaign/application Redis URL.
const enabled =
  !!url &&
  ["127.0.0.1", "localhost"].includes(new URL(url).hostname) &&
  new URL(url).port === "6379";
const makeClient = () =>
  createClient({ url, socket: { reconnectStrategy: false } });
const clients: ReturnType<typeof makeClient>[] = [];
const cleanup: { client: ReturnType<typeof makeClient>; keys: string[] }[] = [];
afterEach(async () => {
  for (const x of cleanup.splice(0)) await x.client.del(x.keys);
  for (const c of clients.splice(0)) if (c.isOpen) c.destroy();
});
async function setup() {
  const c = makeClient();
  c.on("error", () => {});
  await c.connect();
  clients.push(c);
  const prefix = `{feasibility-test-${randomUUID()}}`;
  const keys = [
    `${prefix}:budget`,
    `${prefix}:owner`,
    `${prefix}:claim`,
    `${prefix}:journal`,
  ];
  cleanup.push({ client: c, keys });
  const now = Date.now();
  const b: Record<string, string> = {};
  for (let i = 1; i <= 4; i++) {
    b[`used${i}`] = "0";
    b[`start${i}`] = String(Math.floor(now / 1000));
  }
  for (let i = 1; i <= 3; i++) {
    b[`attemptUsed${i}`] = "0";
    b[`attemptStart${i}`] = String(now);
  }
  await c.hSet(keys[0], b);
  await c.hSet(keys[1], { identity: "test-owner" });
  const call = (
    action: string,
    event: Record<string, unknown> = {},
    cap = 500000000,
    attempts = 2,
  ) =>
    c.eval(STORE_SCRIPT, {
      keys,
      arguments: [
        "test-owner",
        action,
        "manifest",
        JSON.stringify({ kind: action, ...event }),
        "[2,2,2,2,30,30000]",
        String(attempts),
        String(cap),
        "test",
        String(now + 60000),
      ],
    });
  return { c, keys, call };
}
describe("durability validation", () => {
  const cfg = {
    appendonly: "yes",
    appendfsync: "always",
    "maxmemory-policy": "noeviction",
    "no-appendfsync-on-rewrite": "no",
  };
  const info = "aof_enabled:1\r\naof_last_write_status:ok\r\nloading:0\r\n";
  it("requires successful synchronous AOF and no eviction", () => {
    expect(() => checkDurability(cfg, info)).not.toThrow();
  });
  it.each(Object.keys(cfg))("rejects changed %s", (key) => {
    expect(() =>
      checkDurability({ ...cfg, [key]: "unexpected" }, info),
    ).toThrow();
  });
  it("rejects write errors and loading state", () => {
    expect(() =>
      checkDurability(cfg, info.replace("status:ok", "status:err")),
    ).toThrow();
    expect(() =>
      checkDurability(cfg, info.replace("loading:0", "loading:1")),
    ).toThrow();
  });
});
describe.skipIf(!enabled)(
  "atomic evaluation accounting against isolated CI test keys",
  () => {
    it("read-only inspect leaves counters unchanged and rejects missing counters", async () => {
      const { c, keys, call } = await setup();
      const before = await c.hGetAll(keys[0]);
      expect(await call("inspect")).toEqual([2, 2]);
      expect(await c.hGetAll(keys[0])).toEqual(before);
      await c.hDel(keys[0], "attemptUsed3");
      await expect(call("claim")).rejects.toThrow();
      expect(await c.exists(keys[2])).toBe(0);
    });
    it("allows only one concurrent claim and never resumes after stop", async () => {
      const { call } = await setup();
      const claims = await Promise.allSettled([call("claim"), call("claim")]);
      expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await call("stop");
      await expect(call("claim")).rejects.toThrow();
      await expect(call("reserve")).rejects.toThrow();
    });
    it("retains unknown reservation, forbids overlaps, enforces two attempts", async () => {
      const { call, c, keys } = await setup();
      await call("claim");
      await call("reserve");
      await expect(call("reserve")).rejects.toThrow();
      expect(await c.hGet(keys[2], "accounted")).toBe("308100000");
      await call("settle", { id: 1, accountedNanoUsd: 300000, stop: false });
      await call("reserve");
      await call("settle", { id: 2, accountedNanoUsd: 300000, stop: false });
      await expect(call("reserve")).rejects.toThrow();
      expect(await c.hGet(keys[0], "used4")).toBe("0"); // this layer never rewrites app accounting
    });
    it("honors lower money and attempt ceilings", async () => {
      const { call } = await setup();
      await call("claim");
      await expect(call("reserve", {}, 1)).rejects.toThrow();
      await call("reserve");
      await call("settle", { id: 1, accountedNanoUsd: 308100000, stop: false });
      await expect(call("reserve")).rejects.toThrow();
      await expect(call("reserve", {}, 500000000, 1)).rejects.toThrow();
    });
    it("refuses expired state, unknown owners and exhausted total allowance", async () => {
      const { c, keys, call } = await setup();
      await c.expire(keys[0], 60);
      await expect(call("claim")).rejects.toThrow();
      await c.persist(keys[0]);
      await c.hSet(keys[1], "identity", "other");
      await expect(call("claim")).rejects.toThrow();
      await c.hSet(keys[1], "identity", "test-owner");
      await c.hSet(keys[0], "attemptUsed3", "2");
      await expect(call("claim")).rejects.toThrow();
    });
  },
);
