import { expect, it } from "vitest";
import { createClient } from "@redis/client";
import { randomUUID } from "node:crypto";
import { SPEND_SCRIPT, RATE_CARD } from "../src/lib/ai/investigation-budget";
const url = process.env.REDIS_TEST_URL;
it.skipIf(!url)(
  "real Redis enforces permanent dollar ceiling, one workflow, corruption and deletion fail closed",
  async () => {
    const a = await createClient({ url }).connect(),
      b = await createClient({ url }).connect();
    const prefix = `{investigation-budget-test-${randomUUID()}}`;
    const keys = [`${prefix}:usd`, `${prefix}:lock`];
    const run = (client: typeof a, action: string, owner = "a") =>
      client.eval(SPEND_SCRIPT, {
        keys,
        arguments: [action, RATE_CARD, owner],
      });
    try {
      expect(await run(a, "claim")).toEqual(["controls"]);
      await a.hSet(keys[0], {
        status: "approved",
        rateCard: RATE_CARD,
        ceilingMicros: "10000000",
        reservedMicros: "0",
        attempts: "0",
      });
      expect(await run(a, "claim")).toEqual(["acquired"]);
      expect(await run(b, "claim", "b")).toEqual(["busy"]);
      expect(await run(b, "reserve", "b")).toEqual(["controls"]);
      const outcomes = await Promise.all(
        Array.from({ length: 40 }, (_, i) => run(i % 2 ? a : b, "reserve")),
      );
      expect(
        outcomes.filter((o) => JSON.stringify(o) === '["acquired"]'),
      ).toHaveLength(32);
      expect(await a.hGet(keys[0], "reservedMicros")).toBe("9920000");
      expect(await a.hGet(keys[0], "attempts")).toBe("32");
      expect(await a.ttl(keys[0])).toBe(-1);
      expect(await run(b, "reserve")).toEqual(["budget"]);
      // A new process/connection cannot reset the permanent allowance.
      await a.del(keys[1]);
      expect(await run(b, "claim", "restart")).toEqual(["budget"]);
      await a.expire(keys[0], 60);
      expect(await run(b, "claim")).toEqual(["controls"]);
      await a.persist(keys[0]);
      await a.hSet(keys[0], "reservedMicros", "0");
      expect(await run(b, "claim")).toEqual(["controls"]);
      await a.del(keys[0]);
      expect(await run(b, "claim")).toEqual(["controls"]);
    } finally {
      await a.del(keys);
      a.destroy();
      b.destroy();
    }
  },
);
