import "server-only";
import { evalScript } from "./controls";
import { UsageFailure } from "./request-controls";

/**
 * Dollar ceiling for every provider attempt, shared across instances.
 *
 * Each attempt reserves its worst case before dispatch: one token per payload
 * byte (no tokenizer packs fewer than one byte per token) plus the full output
 * allowance, priced at the configured retail rates. Real usage is normally far
 * lower, so the ledger stops spending before the bill can reach the ceiling.
 * Reservations are never refunded and the ledger never expires.
 *
 * Separate ledger names (AI_SPEND_LEDGER) keep testing from consuming the
 * allowance reserved for judges.
 */
export const MAX_CEILING_USD = 50;

export function spendRates() {
  const rate = (name: string, fallback: number) => {
    const value = Number(process.env[name] ?? fallback);
    return Number.isFinite(value) && value > 0 && value <= 100
      ? value
      : fallback;
  };
  // GPT-5.4 Mini Global Standard retail, USD per million tokens.
  return {
    input: rate("AI_PRICE_INPUT_PER_MTOK", 0.75),
    output: rate("AI_PRICE_OUTPUT_PER_MTOK", 4.5),
  };
}

/** Worst-case micro-dollars for one attempt with this payload. */
export function attemptMicros(payloadBytes: number, outputTokens: number) {
  const { input, output } = spendRates();
  // +256 tokens covers provider-side message framing.
  return Math.ceil((payloadBytes + 256) * input + outputTokens * output);
}

export function spendCeilingMicros(): number | null {
  const raw = process.env.AI_SPEND_CEILING_USD;
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(Math.min(value, MAX_CEILING_USD) * 1_000_000);
}

export function ledgerName() {
  const name = process.env.AI_SPEND_LEDGER ?? "default";
  return /^[a-z0-9-]{1,32}$/.test(name) ? name : "default";
}

export const ledgerKey = (name = ledgerName()) =>
  `{second-look-ai}:spend:${name}:v1`;

export const SPEND_RESERVE_SCRIPT = `
local amount = tonumber(ARGV[1])
local ceiling = tonumber(ARGV[2])
if not amount or amount <= 0 or not ceiling or ceiling <= 0 then return {'controls'} end
local used = tonumber(redis.call('HGET', KEYS[1], 'reservedMicros') or '0')
if used + amount > ceiling then return {'budget', tostring(used)} end
redis.call('HINCRBY', KEYS[1], 'reservedMicros', amount)
redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return {'acquired', tostring(used + amount)}
`;

const local = new Map<string, { reservedMicros: number; attempts: number }>();

/** Test hook: clears the in-process ledger only. Never touches Redis. */
export function resetLocalSpendLedger() {
  local.clear();
}

/**
 * Reserve the worst case for one attempt. Without a configured ceiling this is
 * a no-op outside production; production fails closed.
 */
export async function reserveSpend(payloadBytes: number, outputTokens: number) {
  const ceiling = spendCeilingMicros();
  if (ceiling === null) {
    if (process.env.NODE_ENV === "production")
      throw new UsageFailure("controls");
    return null;
  }
  if (ceiling === 0) throw new UsageFailure("budget");
  const amount = attemptMicros(payloadBytes, outputTokens);
  const key = ledgerKey();
  if (!process.env.AI_REDIS_URL) {
    if (process.env.NODE_ENV === "production")
      throw new UsageFailure("controls");
    const entry = local.get(key) ?? { reservedMicros: 0, attempts: 0 };
    if (entry.reservedMicros + amount > ceiling)
      throw new UsageFailure("budget");
    entry.reservedMicros += amount;
    entry.attempts++;
    local.set(key, entry);
    return { reservedMicros: entry.reservedMicros, amount };
  }
  let result: string[];
  try {
    result = (await evalScript(
      SPEND_RESERVE_SCRIPT,
      [key],
      [String(amount), String(ceiling)],
    )) as string[];
  } catch {
    throw new UsageFailure("controls");
  }
  if (result[0] === "budget") throw new UsageFailure("budget");
  if (result[0] !== "acquired") throw new UsageFailure("controls");
  return { reservedMicros: Number(result[1]), amount };
}
