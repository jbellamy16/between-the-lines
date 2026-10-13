import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@redis/client";
import { sharedTasks, untilAborted } from "./wait";
export class WorkflowFailure extends Error {
  constructor(readonly category: "controls" | "budget" | "busy") {
    super(
      category === "busy"
        ? "Narration already in progress; try again shortly"
        : category === "budget"
          ? "Narration usage limit reached"
          : "Shared usage controls unavailable",
    );
  }
}
export function usageStoreReady() {
  return (
    !!process.env.AI_REDIS_URL ||
    (process.env.NODE_ENV !== "production" &&
      process.env.AI_USAGE_STORE === "memory")
  );
}
export function limit(name: string, fallback: number, ceiling: number) {
  const raw = Number(process.env[name] ?? fallback);
  return Number.isFinite(raw)
    ? Math.max(0, Math.min(ceiling, Math.floor(raw)))
    : 0;
}
export function limits() {
  return [
    limit("AI_MINUTE_LIMIT", 4, 10),
    // Up to 1000 so judging-week bursts fit; the dollar ledger is the stop.
    limit(
      "AI_HOURLY_LIMIT",
      Number(process.env.FOUNDRY_HOURLY_LIMIT ?? 30),
      1000,
    ),
    limit("AI_DAILY_LIMIT", 60, 500),
    limit("AI_TOTAL_LIMIT", 100, 5000),
  ];
}
// All keys share a Redis cluster hash slot. Reservations never refunded: a failed call may be billable.
export const CLAIM_SCRIPT = `
local cached = redis.call('GET', KEYS[1])
if cached then return {'cached', cached} end
if redis.call('EXISTS', KEYS[2]) == 1 then return {'busy'} end
local now = tonumber(redis.call('TIME')[1])
local periods = {60, 3600, 86400, 0}
for i = 1,4 do
  local start = tonumber(redis.call('HGET', KEYS[3], 'start'..i) or '0')
  if periods[i] > 0 and now - start >= periods[i] then
    redis.call('HSET', KEYS[3], 'start'..i, now, 'used'..i, 0)
  end
  local used = tonumber(redis.call('HGET', KEYS[3], 'used'..i) or '0')
  if used >= tonumber(ARGV[i]) then return {'limited'} end
end
for i = 1,4 do redis.call('HINCRBY', KEYS[3], 'used'..i, 1) end
redis.call('SET', KEYS[2], ARGV[5], 'EX', 70)
return {'acquired'}
`;
export const FINISH_SCRIPT = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
if ARGV[2] ~= '' then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', 3600)
  redis.call('DEL', KEYS[2])
else
  redis.call('EXPIRE', KEYS[2], 5)
end
return 1
`;
const makeClient = (url: string) =>
  createClient({
    url,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
type Client = ReturnType<typeof makeClient>;
let connection: Promise<Client> | undefined;
async function redis() {
  if (!process.env.AI_REDIS_URL)
    throw new Error("Shared usage controls unavailable");
  const url = new URL(process.env.AI_REDIS_URL);
  if (process.env.NODE_ENV === "production" && url.protocol !== "rediss:")
    throw new Error("TLS required");
  if (!connection) {
    const client = makeClient(url.href);
    client.on("error", () => {}); // Never log connection URLs or credentials.
    connection = client
      .connect()
      .then(() => client)
      .catch((error) => {
        connection = undefined;
        throw error;
      });
  }
  return connection!;
}
export async function evalScript(
  script: string,
  keys: string[],
  args: string[],
) {
  const client = await redis();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      client.eval(script, { keys, arguments: args }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          connection = undefined;
          client.destroy();
          reject(new Error("Usage controls timed out"));
        }, 3000);
      }),
    ]);
  } catch (error) {
    connection = undefined;
    if (client.isOpen) client.destroy();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
const localCache = new Map<
  string,
  { expires: number; value?: unknown; owner?: string }
>();
const localWindows = [60, 3600, 86400, 0].map((seconds) => ({
  seconds,
  start: Date.now(),
  used: 0,
}));
function localClaim(key: string, owner: string): [string, string?] {
  const now = Date.now();
  for (const [k, v] of localCache) if (v.expires <= now) localCache.delete(k);
  const cached = localCache.get(key);
  if (cached)
    return cached.value ? ["cached", JSON.stringify(cached.value)] : ["busy"];
  const quotas = limits();
  for (const window of localWindows)
    if (window.seconds && now - window.start >= window.seconds * 1000) {
      window.start = now;
      window.used = 0;
    }
  if (
    localWindows.some((w, i) => w.used >= quotas[i]) ||
    localCache.size >= 100
  )
    return ["limited"];
  localWindows.forEach((w) => w.used++);
  localCache.set(key, { expires: now + 70000, owner });
  return ["acquired"];
}
const share = sharedTasks<{ result: unknown; cached: boolean }>();
export async function controlledNarration<T>(
  identity: unknown,
  generate: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) {
  if (!usageStoreReady()) throw new WorkflowFailure("controls");
  const key = createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
  return share(
    key,
    (sharedSignal) => claimAndGenerate(key, generate, sharedSignal),
    signal,
  ) as Promise<{ result: T; cached: boolean }>;
}
async function claimAndGenerate<T>(
  key: string,
  generate: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const keys = [
    `{second-look-ai}:v1:cache:${key}`,
    `{second-look-ai}:v1:lock:${key}`,
    "{second-look-ai}:budget",
  ];
  const token = randomUUID();
  const useRedis = !!process.env.AI_REDIS_URL;
  const [status, cached] = await (async () => {
    try {
      return (
        useRedis
          ? await evalScript(CLAIM_SCRIPT, keys, [
              ...limits().map(String),
              token,
            ])
          : localClaim(key, token)
      ) as string[];
    } catch {
      throw new WorkflowFailure("controls");
    }
  })();
  if (status === "cached") {
    try {
      return { result: JSON.parse(cached) as T, cached: true };
    } catch {
      throw new WorkflowFailure("controls");
    }
  }
  if (status !== "acquired")
    throw new WorkflowFailure(
      status === "busy" ? "busy" : status === "limited" ? "budget" : "controls",
    );
  const workflowSignal = AbortSignal.any([signal, AbortSignal.timeout(55000)]);
  try {
    workflowSignal.throwIfAborted();
    const result = await untilAborted(generate(workflowSignal), workflowSignal);
    workflowSignal.throwIfAborted();
    if (useRedis) {
      try {
        const finished = await evalScript(FINISH_SCRIPT, keys, [
          token,
          JSON.stringify(result),
        ]);
        if (finished !== 1) throw new WorkflowFailure("controls");
      } catch {
        throw new WorkflowFailure("controls");
      }
    } else if (localCache.get(key)?.owner === token)
      localCache.set(key, { expires: Date.now() + 3600000, value: result });
    return { result, cached: false };
  } catch (error) {
    if (useRedis)
      await evalScript(FINISH_SCRIPT, keys, [token, ""]).catch(() => {});
    else if (localCache.get(key)?.owner === token)
      localCache.set(key, { expires: Date.now() + 5000 });
    throw error;
  }
}
