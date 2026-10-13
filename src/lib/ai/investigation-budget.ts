import "server-only";
import { randomUUID } from "node:crypto";
import { evalScript } from "./controls";
import { UsageFailure } from "./request-controls";

// A new, separately approved allowance. Never an evaluation ledger or a reset.
export const INVESTIGATION_BUDGET_KEY =
  "{second-look-ai}:explicit-investigation:usd:v1";
const lockKey = "{second-look-ai}:explicit-investigation:lock:v1";
export const RATE_CARD = "gpt-5.4-mini-2026-03-17-global-2026-10-12";
export const LUNA_RATE_CARD = "gpt-6-luna-2026-09-22-global-2026-10-12";
const rateCards = [
  {
    id: RATE_CARD,
    deployment: "between-the-lines-gpt54-mini",
    input: 0.75,
    output: 4.5,
  },
  // Conservative estimate includes long-context cache-write pricing. Actual
  // short-context usage normally costs less; this is never an invoice.
  {
    id: LUNA_RATE_CARD,
    deployment: "between-the-lines-gpt-6-luna-1",
    input: 0.25,
    output: 0.75,
  },
] as const;
export function configuredInvestigationRateCard() {
  return rateCards.find(
    (card) =>
      card.id === process.env.AI_INVESTIGATOR_RATE_CARD &&
      card.deployment === process.env.FOUNDRY_DEPLOYMENT,
  );
}
export const MAX_BUDGET_MICROS = 10_000_000;
// Entire 400k context at $0.75/M + 1800 output at $4.50/M = $0.3081.
// Luna: entire 1.05M at long-context cache-write $0.25/M + 1800 at $0.75/M
// = $0.26385. The SAME $0.31 reservation covers both without resetting counters.
// Round UP. Never use the token pacing heuristic as a dollar bound; no refunds.
export const ATTEMPT_MICROS = 310_000;
export const SPEND_SCRIPT = `
local ceiling = tonumber(redis.call('HGET', KEYS[1], 'ceilingMicros'))
local used = tonumber(redis.call('HGET', KEYS[1], 'reservedMicros'))
local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts'))
if redis.call('HGET', KEYS[1], 'status') ~= 'approved' or
   (redis.call('HGET', KEYS[1], 'rateCard') ~= ARGV[2] and
    redis.call('HGET', KEYS[1], 'additionalRateCard') ~= ARGV[2]) or
   redis.call('TTL', KEYS[1]) ~= -1 or
   not ceiling or ceiling <= 0 or ceiling > 10000000 or ceiling ~= math.floor(ceiling) or
   not used or used < 0 or used ~= math.floor(used) or
   not attempts or attempts < 0 or attempts ~= math.floor(attempts) or
   used ~= attempts * 310000 then return {'controls'} end
if used + 310000 > ceiling then return {'budget'} end
if ARGV[1] == 'claim' then
  if not redis.call('SET', KEYS[2], ARGV[3], 'NX', 'EX', 70) then return {'busy'} end
  return {'acquired'}
end
if redis.call('GET', KEYS[2]) ~= ARGV[3] or redis.call('PTTL', KEYS[2]) < 18000 then return {'controls'} end
redis.call('HINCRBY', KEYS[1], 'reservedMicros', 310000)
redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return {'acquired'}
`;
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;
export async function investigationBudget() {
  const rateCard = configuredInvestigationRateCard();
  // Production and development explicit inference both require durable TLS Redis.
  if (!process.env.AI_REDIS_URL?.startsWith("rediss://") || !rateCard)
    throw new UsageFailure("controls");
  const owner = randomUUID();
  let reservedMicros = 0;
  async function run(action: "claim" | "reserve") {
    let result: string[];
    try {
      result = (await evalScript(
        SPEND_SCRIPT,
        [INVESTIGATION_BUDGET_KEY, lockKey],
        [action, rateCard!.id, owner],
      )) as string[];
    } catch {
      throw new UsageFailure("controls");
    }
    if (result[0] !== "acquired")
      throw new UsageFailure(result[0] === "budget" ? "budget" : "controls");
  }
  await run("claim");
  return {
    reserve: async () => {
      await run("reserve");
      reservedMicros += ATTEMPT_MICROS;
    },
    reservedUsd: () => reservedMicros / 1_000_000,
    release: () =>
      evalScript(RELEASE_SCRIPT, [lockKey], [owner]).catch(() => {}),
  };
}
