/**
 * Show how much of each spend ledger has been reserved.
 *   npm run ai:spend
 * Reads AI_REDIS_URL from the shell or .env.local. Read-only.
 */
import { createClient } from "@redis/client";
import { localAiConfig } from "./ai-local-config.mjs";

const url =
  process.env.AI_REDIS_URL ?? localAiConfig(process.cwd()).AI_REDIS_URL;
if (!url) {
  console.log(
    "No AI_REDIS_URL set. Local runs without Redis use an in-process ledger that resets on restart.",
  );
  process.exit(0);
}
const client = createClient({
  url,
  socket: { connectTimeout: 5000, reconnectStrategy: false },
});
client.on("error", () => {});
await client.connect();
const keys = [];
for await (const batch of client.scanIterator({
  MATCH: "{second-look-ai}:spend:*",
  COUNT: 100,
}))
  keys.push(...(Array.isArray(batch) ? batch : [batch]));
if (!keys.length) console.log("No spend ledgers yet.");
for (const key of keys.sort()) {
  const v = await client.hGetAll(key);
  const name = key.split(":")[2];
  const reserved = Number(v.reservedMicros ?? 0) / 1e6;
  console.log(
    `${name.padEnd(12)} reserved $${reserved.toFixed(4)} across ${v.attempts ?? 0} attempts (worst-case reservations; actual spend is lower)`,
  );
}
await client.quit();
