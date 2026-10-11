import "server-only";
import { randomUUID } from "node:crypto";
import { evalScript, limit, limits, usageStoreReady } from "./controls";
import { wait } from "./wait";

export class UsageFailure extends Error {
  constructor(
    readonly category: "budget" | "capacity" | "controls",
    readonly retryAfterMs?: number,
  ) {
    super(`AI ${category} unavailable`);
  }
}

// Application ceilings, not a claim about the current Azure allocation. These
// may be lowered, never raised above the reviewed operating envelope.
export const requestLimits = () => ({
  rpm: limit("AI_REQUEST_MINUTE_LIMIT", 10, 10),
  tpm: limit("AI_TOKEN_MINUTE_LIMIT", 10000, 10000),
});

// Same Redis cluster slot and durable budget as workflow reservations. Each
// dispatch (including retries/unknown usage) is charged; no refunds or resets.
export const ATTEMPT_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
local rpm, tpm, tokens = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
if rpm <= 0 or tpm <= 0 or tokens > tpm or tokens <= 0 then return {'budget'} end
local periods = {3600000,86400000,0}
for i = 1,3 do
  local start = tonumber(redis.call('HGET', KEYS[4], 'attemptStart'..i) or '0')
  if periods[i] > 0 and now - start >= periods[i] then
    redis.call('HSET', KEYS[4], 'attemptStart'..i, now, 'attemptUsed'..i, 0)
  end
  local used = tonumber(redis.call('HGET', KEYS[4], 'attemptUsed'..i) or '0')
  if used >= tonumber(ARGV[3+i]) then return {'budget'} end
end
local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now - 60000)
for _,id in ipairs(expired) do redis.call('HDEL', KEYS[2], id) end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60000)
if redis.call('ZCARD', KEYS[1]) ~= redis.call('HLEN', KEYS[2]) then return {'controls'} end
local total = 0
local amounts = redis.call('HVALS', KEYS[2])
for _,amount in ipairs(amounts) do
  local value = tonumber(amount)
  if not value or value <= 0 then return {'controls'} end
  total = total + value
end
local nextAt = tonumber(redis.call('HGET', KEYS[3], 'nextAt') or '0')
local cooldown = tonumber(redis.call('HGET', KEYS[3], 'cooldown') or '0')
local delay = math.max(0, nextAt - now, cooldown - now)
if redis.call('ZCARD', KEYS[1]) >= rpm or total + tokens > tpm then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  if #oldest == 0 then return {'controls'} end
  delay = math.max(delay, tonumber(oldest[2]) + 60000 - now)
end
if delay > 0 then return {'wait', tostring(delay)} end
for i = 1,3 do redis.call('HINCRBY', KEYS[4], 'attemptUsed'..i, 1) end
redis.call('ZADD', KEYS[1], now, ARGV[7])
redis.call('HSET', KEYS[2], ARGV[7], tokens)
redis.call('HSET', KEYS[3], 'nextAt', now + math.ceil(60000/rpm))
redis.call('PEXPIRE', KEYS[1], 120000)
redis.call('PEXPIRE', KEYS[2], 120000)
return {'acquired'}
`;
export const COOLDOWN_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
local current = tonumber(redis.call('HGET', KEYS[1], 'cooldown') or '0')
redis.call('HSET', KEYS[1], 'cooldown', math.max(current, now + tonumber(ARGV[1])))
return 1
`;
const keys = [
  "{second-look-ai}:attempts:v1:times",
  "{second-look-ai}:attempts:v1:tokens",
  "{second-look-ai}:attempts:v1:pacing",
  "{second-look-ai}:budget",
];
const local = {
  entries: [] as { time: number; tokens: number }[],
  nextAt: 0,
  cooldown: 0,
  windows: [3600000, 86400000, 0].map((period) => ({
    period,
    start: Date.now(),
    used: 0,
  })),
};
function localAttempt(tokens: number): [string, string?] {
  const now = Date.now(),
    { rpm, tpm } = requestLimits();
  const quotas = limits().slice(1);
  if (!rpm || !tpm || tokens > tpm || tokens <= 0) return ["budget"];
  for (const window of local.windows)
    if (window.period && now - window.start >= window.period) {
      window.start = now;
      window.used = 0;
    }
  if (local.windows.some((w, i) => w.used >= quotas[i])) return ["budget"];
  local.entries = local.entries.filter((e) => e.time > now - 60000);
  let delay = Math.max(0, local.nextAt - now, local.cooldown - now);
  if (
    local.entries.length >= rpm ||
    local.entries.reduce((sum, e) => sum + e.tokens, 0) + tokens > tpm
  )
    delay = Math.max(delay, local.entries[0].time + 60000 - now);
  if (delay > 0) return ["wait", String(delay)];
  local.windows.forEach((w) => w.used++);
  local.entries.push({ time: now, tokens });
  local.nextAt = now + Math.ceil(60000 / rpm);
  return ["acquired"];
}
async function safely<T>(work: () => Promise<T>): Promise<T> {
  if (!usageStoreReady()) throw new UsageFailure("controls");
  try {
    return await work();
  } catch (error) {
    if (error instanceof UsageFailure) throw error;
    throw new UsageFailure("controls");
  }
}
export async function providerCooldown(delayMs: number) {
  await safely(async () => {
    if (process.env.AI_REDIS_URL)
      await evalScript(COOLDOWN_SCRIPT, [keys[2]], [String(delayMs)]);
    else local.cooldown = Math.max(local.cooldown, Date.now() + delayMs);
  });
}
export async function reserveProviderAttempt(
  tokens: number,
  deadline: number,
  signal: AbortSignal,
  transportAllowance = 18000,
) {
  if (!Number.isSafeInteger(tokens) || tokens <= 0)
    throw new UsageFailure("budget");
  for (;;) {
    signal.throwIfAborted();
    // Leave a full transport allowance. Never hold a lease while waiting beyond
    // the workflow deadline, or dispatch a request that cannot fit inside it.
    if (Date.now() + transportAllowance > deadline)
      throw new UsageFailure("capacity");
    const [status, delay] = await safely(async () => {
      const { rpm, tpm } = requestLimits();
      return (
        process.env.AI_REDIS_URL
          ? await evalScript(
              ATTEMPT_SCRIPT,
              keys,
              [rpm, tpm, tokens, ...limits().slice(1), randomUUID()].map(
                String,
              ),
            )
          : localAttempt(tokens)
      ) as string[];
    });
    signal.throwIfAborted();
    if (status === "acquired") return;
    if (status !== "wait")
      throw new UsageFailure(status === "budget" ? "budget" : "controls");
    const ms = Number(delay);
    if (!Number.isFinite(ms) || ms <= 0) throw new UsageFailure("controls");
    if (Date.now() + ms + transportAllowance > deadline)
      throw new UsageFailure("capacity", ms);
    await wait(ms, signal);
  }
}
