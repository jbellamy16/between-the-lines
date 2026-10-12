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
export const STORE_SCRIPT = `
if string.sub(KEYS[2],1,string.len('{second-look-ai}:study:')) == '{second-look-ai}:study:' then return redis.error_reply('Historical owner forbidden') end
if redis.call('TTL',KEYS[1]) ~= -1 or redis.call('TTL',KEYS[2]) ~= -1 then return redis.error_reply('Existing durable state required') end
if redis.call('HGET',KEYS[2],'identity') ~= ARGV[1] then return redis.error_reply('Owner mismatch') end
if redis.call('HLEN',KEYS[1])~=14 then return redis.error_reply('Incomplete existing counters') end
local clock=redis.call('TIME')
local now=tonumber(clock[1])*1000+math.floor(tonumber(clock[2])/1000)
if now >= tonumber(ARGV[9]) then return redis.error_reply('Authorization expired') end
local quotas=cjson.decode(ARGV[5])
local remaining={}
for _,group in ipairs({'workflow','attempt'}) do
 local periods=group=='workflow' and {60,3600,86400,0} or {3600000,86400000,0}
 local available=9007199254740991
 for i,period in ipairs(periods) do
  local up=group=='workflow' and 'used' or 'attemptUsed'
  local sp=group=='workflow' and 'start' or 'attemptStart'
  local used=redis.call('HGET',KEYS[1],up..i)
  local start=redis.call('HGET',KEYS[1],sp..i)
  if not used or not start or not string.match(used,'^%d+$') or not string.match(start,'^%d+$') or tonumber(used)>9007199254740991 or tonumber(start)>9007199254740991 or tonumber(start)<=0 then return redis.error_reply('Corrupt counters') end
  local t=group=='workflow' and math.floor(now/1000) or now
  if tonumber(start)>t then return redis.error_reply('Future counter') end
  local effective=tonumber(used)
  if period>0 and t-tonumber(start)>=period then effective=0 end
  available=math.min(available,quotas[i+(group=='attempt' and 1 or 0)]-effective)
 end
 table.insert(remaining,available)
end
if ARGV[2]=='inspect' then return remaining end
if ARGV[2]=='claim' then
 if remaining[1]<1 or remaining[2]<1 or quotas[5]<1 or quotas[6]<1 then return redis.error_reply('No allowance') end
 if redis.call('EXISTS',KEYS[3])==1 or redis.call('EXISTS',KEYS[4])==1 then return redis.error_reply('Already claimed') end
 redis.call('HSET',KEYS[3],'identity',ARGV[3],'attempts',0,'accounted',0,'pending',0,'stopped',0)
elseif redis.call('HGET',KEYS[3],'identity')~=ARGV[3] or redis.call('TTL',KEYS[3])~=-1 or redis.call('TTL',KEYS[4])~=-1 then
 return redis.error_reply('Claim mismatch')
elseif ARGV[2]=='reserve' then
 local attempts=tonumber(redis.call('HGET',KEYS[3],'attempts'))
 local accounted=tonumber(redis.call('HGET',KEYS[3],'accounted'))
 if not attempts or not accounted or redis.call('HGET',KEYS[3],'pending')~='0' or redis.call('HGET',KEYS[3],'stopped')~='0' or attempts>=tonumber(ARGV[6]) or accounted+308100000>tonumber(ARGV[7]) then return redis.error_reply('Reservation refused') end
 redis.call('HINCRBY',KEYS[3],'attempts',1)
 redis.call('HINCRBY',KEYS[3],'accounted',308100000)
 redis.call('HSET',KEYS[3],'pending',attempts+1)
elseif ARGV[2]=='settle' then
 local event=cjson.decode(ARGV[4])
 if tonumber(redis.call('HGET',KEYS[3],'pending'))~=event.id or event.id<=0 or event.accountedNanoUsd<0 or event.accountedNanoUsd>308100000 then return redis.error_reply('Settlement refused') end
 redis.call('HINCRBY',KEYS[3],'accounted',event.accountedNanoUsd-308100000)
 redis.call('HSET',KEYS[3],'pending',0)
 if event.stop then redis.call('HSET',KEYS[3],'stopped',1) end
elseif ARGV[2]=='stop' then redis.call('HSET',KEYS[3],'stopped',1)
else return redis.error_reply('Unknown operation') end
redis.call('RPUSH',KEYS[4],ARGV[4])
return {redis.call('HGETALL',KEYS[3]),redis.call('LRANGE',KEYS[4],0,-1)}
`;
export function checkDurability(config: Record<string, string>, info: string) {
  if (
    config.appendonly !== "yes" ||
    config.appendfsync !== "always" ||
    config["maxmemory-policy"] !== "noeviction" ||
    config["no-appendfsync-on-rewrite"] !== "no" ||
    !["aof_enabled:1", "aof_last_write_status:ok", "loading:0"].every((v) =>
      info.includes(`${v}\r\n`),
    )
  )
    throw new Error("Existing Redis durability cannot be verified");
}
export function durableStore(
  auth: Authorization,
  env: Record<string, string | undefined> = process.env,
) {
  const url = env.AI_REDIS_URL;
  if (
    !url ||
    env.AI_USAGE_STORE !== "redis" ||
    digest(url) !== auth.redisIdentitySha256 ||
    auth.existingOwnerKey.startsWith("{second-look-ai}:study:") ||
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
