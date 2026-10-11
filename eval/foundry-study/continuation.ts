import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@redis/client";
import { CAPS, STUDY, digest } from "./ledger";

export const CONTINUATION = `${STUDY}-continuation-1`;
export const CONTINUATION_OUTPUT = resolve(`docs/intelligence/${CONTINUATION}`);
export const STUDY_REDIS_URL = "redis://127.0.0.1:16379";
export const PARENT_HASH =
  "ff322dcc9fe7e9a4ecaa4afbdad98d948c8d2cb2f479d02943f4d5da06d97244";
export const BUDGET_KEY = "{second-look-ai}:budget";
export const OWNER_KEY = `{second-look-ai}:study:${CONTINUATION}`;
const identity = JSON.stringify({
  study: CONTINUATION,
  parent: PARENT_HASH,
  caps: CAPS,
});

/** One hard-coded continuation, only of the immutable zero-spend blocked run.
 * No path, sequence, reset or force parameter can allocate another budget. */
export function verifyParent() {
  const root = resolve(`docs/intelligence/${STUDY}`);
  const raw = readFileSync(`${root}/receipt-hashes.json`, "utf8");
  if (digest(raw) !== PARENT_HASH)
    throw new Error("Parent receipt index changed");
  const hashes = JSON.parse(raw) as Record<string, string>;
  for (const [name, hash] of Object.entries(hashes))
    if (digest(readFileSync(`${root}/${name}`, "utf8")) !== hash)
      throw new Error("Parent receipt changed");
  const result = JSON.parse(readFileSync(`${root}/results.json`, "utf8"));
  const journal = readFileSync(`${root}/ledger.jsonl`, "utf8")
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  if (
    result.actualHttpAttempts !== 0 ||
    result.workflows !== 0 ||
    result.accountedUsd !== 0 ||
    journal.length !== 2 ||
    journal[0].event.kind !== "init" ||
    journal[1].event.kind !== "stop" ||
    journal[1].event.reason !== "blocked_preflight"
  )
    throw new Error("Parent does not authorize a zero-spend continuation");
  return {
    study: STUDY,
    receiptIndexSha256: PARENT_HASH,
    hashes,
    priorWorkflows: 0,
    priorAttempts: 0,
    priorAccountedUsd: 0,
  };
}

export const INIT_ALLOWANCE = `
if redis.call('DBSIZE') ~= 0 then return redis.error_reply('Fresh empty dedicated store required') end
local t = redis.call('TIME')
for i=1,4 do redis.call('HSET',KEYS[1],'used'..i,0,'start'..i,t[1]) end
local ms = tonumber(t[1])*1000 + math.floor(tonumber(t[2])/1000)
for i=1,3 do redis.call('HSET',KEYS[1],'attemptUsed'..i,0,'attemptStart'..i,ms) end
redis.call('HSET',KEYS[2],'identity',ARGV[1],'initializedAt',t[1])
return 'initialized'
`;
// Validate every historical field before the application (which otherwise has
// permissive missing-key defaults) can touch it. Never repair/reset a counter.
export const CHECK_ALLOWANCE = `
if redis.call('HGET',KEYS[2],'identity') ~= ARGV[1] then return redis.error_reply('Unknown study owner') end
if redis.call('TTL',KEYS[1]) ~= -1 or redis.call('TTL',KEYS[2]) ~= -1 then return redis.error_reply('Missing or expiring durable state') end
if redis.call('HLEN',KEYS[1]) ~= 14 then return redis.error_reply('Incomplete counters') end
for _,prefix in ipairs({'used','start','attemptUsed','attemptStart'}) do
  local n = string.sub(prefix,1,7) == 'attempt' and 3 or 4
  for i=1,n do
    local value = redis.call('HGET',KEYS[1],prefix..i)
    if not value or not string.match(value,'^%d+$') or tonumber(value)>9007199254740991 then return redis.error_reply('Corrupt counters') end
    if string.find(prefix,'[Uu]sed') and tonumber(value)>12 then return redis.error_reply('Allowance exceeded') end
    if string.find(prefix,'[Ss]tart') and tonumber(value)<=0 then return redis.error_reply('Corrupt timestamps') end
  end
end
if ARGV[2] == 'claim' then
  if redis.call('HEXISTS',KEYS[2],'execution') == 1 then return redis.error_reply('Continuation already claimed') end
  for _,prefix in ipairs({'used','attemptUsed'}) do
    local n = prefix == 'used' and 4 or 3
    for i=1,n do if redis.call('HGET',KEYS[1],prefix..i) ~= '0' then return redis.error_reply('Previously used allowance') end end
  end
  redis.call('HSET',KEYS[2],'execution',ARGV[3])
end
return {redis.call('HGETALL',KEYS[1]),redis.call('HGETALL',KEYS[2])}
`;
export async function studyStore(
  action: "initialize" | "inspect" | "claim",
  manifest?: string,
  // Tests use their own brand-new Docker database; the live runner pins its URL.
  url = STUDY_REDIS_URL,
) {
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    parsed.protocol !== "redis:" ||
    parsed.pathname
  )
    throw new Error("Dedicated localhost Redis required");
  if (action === "claim" && !/^[a-f0-9]{64}$/.test(manifest ?? ""))
    throw new Error("Frozen manifest required");
  const c = createClient({
    url,
    socket: { reconnectStrategy: false, connectTimeout: 3000 },
    disableOfflineQueue: true,
  });
  c.on("error", () => {});
  const timeout = setTimeout(() => {
    if (c.isOpen) c.destroy();
  }, 5000);
  try {
    await c.connect();
    const config = await c.configGet([
      "appendonly",
      "appendfsync",
      "maxmemory-policy",
      "no-appendfsync-on-rewrite",
    ]);
    const info = await c.info("persistence");
    if (
      config.appendonly !== "yes" ||
      config.appendfsync !== "always" ||
      config["maxmemory-policy"] !== "noeviction" ||
      config["no-appendfsync-on-rewrite"] !== "no" ||
      !info.includes("aof_enabled:1\r\n") ||
      !info.includes("aof_last_write_status:ok\r\n") ||
      !info.includes("loading:0\r\n")
    )
      throw new Error("Redis durability unavailable");
    if (action === "initialize")
      await c.eval(INIT_ALLOWANCE, {
        keys: [BUDGET_KEY, OWNER_KEY],
        arguments: [identity],
      });
    const values = (await c.eval(CHECK_ALLOWANCE, {
      keys: [BUDGET_KEY, OWNER_KEY],
      arguments: [identity, action, manifest ?? ""],
    })) as string[][];
    const pairs = (list: string[]) =>
      Object.fromEntries(
        Array.from({ length: list.length / 2 }, (_, i) => [
          list[2 * i],
          list[2 * i + 1],
        ]),
      );
    return {
      checkedAt: new Date().toISOString(),
      config,
      budget: pairs(values[0]),
      owner: pairs(values[1]),
      aofLastWriteStatus: "ok",
    };
  } finally {
    clearTimeout(timeout);
    if (c.isOpen) c.destroy();
  }
}
