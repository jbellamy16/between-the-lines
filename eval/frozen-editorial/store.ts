import { createClient } from "@redis/client";
import { z } from "zod";
import { quotaSnapshot } from "../guided-study/preflight";
import { STUDY, proposal, digest } from "./plan";
export const BUDGET = "{second-look-ai}:budget";
export const CLAIM = `{second-look-ai}:evaluation:${STUDY}`;
export const JOURNAL = `${CLAIM}:journal`;
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const authorizationSchema = z
  .object({
    study: z.literal(STUDY),
    manifest: sha,
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    expiresAt: z.string().datetime(),
    redisIdentitySha256: sha,
    existingOwnerKey: z.string().startsWith("{second-look-ai}:"),
    existingOwnerIdentity: z.string().min(1),
    maxAttempts: z.number().int().min(1).max(2),
    maxNanoUsd: z.number().int().positive().max(proposal.maxNanoUsd),
  })
  .strict();
export type Authorization = z.infer<typeof authorizationSchema>;
// No initializer exists. Every operation validates the existing non-expiring
// allowance and owner BEFORE touching this study's claim/journal. Historical
// study stores are never a source of allowance for this evaluation.
export {
  STORE_SCRIPT,
  checkDurability,
} from "../investigator-feasibility/store";
import {
  STORE_SCRIPT,
  checkDurability,
} from "../investigator-feasibility/store";
export function durableStore(
  auth: Authorization,
  env: Record<string, string | undefined> = process.env,
) {
  auth = authorizationSchema.parse(auth);
  const url = env.AI_REDIS_URL;
  if (
    !url ||
    env.AI_USAGE_STORE !== "redis" ||
    digest(url) !== auth.redisIdentitySha256 ||
    auth.existingOwnerKey.startsWith("{second-look-ai}:study:") ||
    auth.existingOwnerKey.startsWith("{second-look-ai}:evaluation:") ||
    [BUDGET, CLAIM, JOURNAL].includes(auth.existingOwnerKey)
  )
    throw new Error("Existing authorized durable allowance unavailable");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "rediss:" &&
    !(parsed.protocol === "redis:" && parsed.hostname === "127.0.0.1")
  )
    throw new Error("Redis transport rejected");
  const identity = digest(JSON.stringify(auth));
  return async (
    action: "inspect" | "claim" | "reserve" | "settle" | "stop",
    event: Record<string, unknown> = {},
  ) => {
    const c = createClient({
      url,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    c.on("error", () => {});
    const timeout = setTimeout(() => {
      if (c.isOpen) c.destroy();
    }, 5000);
    try {
      await c.connect();
      checkDurability(
        await c.configGet([
          "appendonly",
          "appendfsync",
          "maxmemory-policy",
          "no-appendfsync-on-rewrite",
        ]),
        await c.info("persistence"),
      );
      // Reject historical dedicated study stores, even if another owner is supplied.
      for await (const keys of c.scanIterator({
        MATCH: "{second-look-ai}:study:*",
        COUNT: 100,
      }))
        if (keys.length)
          throw new Error("Historical allowance cannot be repurposed");
      return await c.eval(STORE_SCRIPT, {
        keys: [BUDGET, auth.existingOwnerKey, CLAIM, JOURNAL],
        arguments: [
          auth.existingOwnerIdentity,
          action,
          identity,
          JSON.stringify({ ...event, kind: action, at: Date.now() }),
          JSON.stringify(quotaSnapshot(env)),
          String(auth.maxAttempts),
          String(auth.maxNanoUsd),
          STUDY,
          String(Date.parse(auth.expiresAt)),
        ],
      });
    } catch {
      throw new Error("Durable accounting unavailable or allowance refused");
    } finally {
      clearTimeout(timeout);
      if (c.isOpen) c.destroy();
    }
  };
}
export type Store = ReturnType<typeof durableStore>;
