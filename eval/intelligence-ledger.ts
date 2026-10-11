import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmdirSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";

export const STUDY = "pr18-intelligence-2026-10-10";
export const ALLOWANCE_USD = 2;
export const MAX_REQUESTS = 60;
export const PRICE = { input: 0.75, cachedInput: 0.075, output: 4.5 };
export const DEPLOYMENT = "between-the-lines-gpt54-mini";
export const ENDPOINT =
  "https://josh-5098-resource.openai.azure.com/openai/v1/responses";
export const EVALUATED_REF = "22fb00517a38a8abadf00ae19d299a74f01d1fa0";
export type Usage = {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
};
type Reservation = {
  kind: "reserve";
  id: number;
  caseId: string;
  reservedUsd: number;
  inputBound: number;
  outputBound: number;
  at: string;
};
type Settlement = {
  kind: "settle";
  id: number;
  estimatedUsd?: number;
  usage?: Usage;
  [key: string]: unknown;
};
type Entry =
  | Reservation
  | Settlement
  | {
      kind: "metadata";
      study: string;
      allowanceUsd: number;
      maxRequests: number;
    };

export function reservationFor(payload: string) {
  const body = JSON.parse(payload);
  const bytes = Buffer.byteLength(payload);
  if (
    body.model !== DEPLOYMENT ||
    body.store !== false ||
    !Number.isInteger(body.max_output_tokens) ||
    body.max_output_tokens < 1 ||
    body.max_output_tokens > 1800 ||
    bytes > 131072
  )
    throw new Error("Request envelope refused");
  // Each UTF-8 byte is conservatively reserved as one token, including JSON,
  // with 8,192 extra input tokens for protocol overhead. No cache discount.
  const inputBound = bytes + 8192;
  return {
    inputBound,
    outputBound: body.max_output_tokens as number,
    reservedUsd:
      (inputBound * PRICE.input + body.max_output_tokens * PRICE.output) / 1e6,
  };
}

export function usageCost(
  usage: Usage,
  reservation: Pick<Reservation, "inputBound" | "outputBound">,
) {
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  if (
    ![usage.input_tokens, usage.output_tokens, cached].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    cached > usage.input_tokens ||
    usage.input_tokens > reservation.inputBound ||
    usage.output_tokens > reservation.outputBound
  )
    throw new Error("Usage outside reserved envelope");
  return (
    ((usage.input_tokens - cached) * PRICE.input +
      cached * PRICE.cachedInput +
      usage.output_tokens * PRICE.output) /
    1e6
  );
}

/** Single-writer append-only journal. Every reservation is fsynced BEFORE HTTP.
 * Crash/unknown usage remains charged. Corruption and stale locks fail closed.
 * Existing study journals are never replaced or reset by this class. */
export class EvaluationLedger {
  private entries: Entry[];
  private lock: string;
  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.lock = `${path}.lock`;
    mkdirSync(this.lock);
    try {
      if (!existsSync(path)) {
        const fd = openSync(path, "wx", 0o600);
        try {
          writeSync(
            fd,
            JSON.stringify({
              kind: "metadata",
              study: STUDY,
              allowanceUsd: ALLOWANCE_USD,
              maxRequests: MAX_REQUESTS,
            }) + "\n",
          );
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        const directory = openSync(dirname(path), "r");
        try {
          fsyncSync(directory);
        } finally {
          closeSync(directory);
        }
      }
      const raw = readFileSync(path, "utf8");
      if (!raw.endsWith("\n")) throw new Error("Incomplete journal");
      this.entries = raw
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const meta = this.entries[0];
      if (
        meta.kind !== "metadata" ||
        meta.study !== STUDY ||
        meta.allowanceUsd !== ALLOWANCE_USD ||
        meta.maxRequests !== MAX_REQUESTS
      )
        throw new Error("Wrong study budget");
      // Validate all persisted accounting before allowing a restart.
      const seen = new Map<number, Reservation>();
      const settled = new Set<number>();
      for (const entry of this.entries.slice(1)) {
        if (entry.kind === "reserve") {
          if (
            entry.id !== seen.size + 1 ||
            !Number.isFinite(entry.reservedUsd) ||
            entry.reservedUsd <= 0 ||
            entry.reservedUsd !==
              (entry.inputBound * PRICE.input +
                entry.outputBound * PRICE.output) /
                1e6
          )
            throw new Error("Invalid reservation journal");
          seen.set(entry.id, entry);
        } else if (entry.kind === "settle") {
          const prior = seen.get(entry.id);
          if (!prior || settled.has(entry.id))
            throw new Error("Invalid settlement journal");
          if (
            entry.estimatedUsd !== undefined &&
            (!entry.usage ||
              usageCost(entry.usage, prior) !== entry.estimatedUsd)
          )
            throw new Error("Invalid usage journal");
          settled.add(entry.id);
        } else throw new Error("Invalid journal entry");
      }
      if (seen.size > MAX_REQUESTS || this.total() > ALLOWANCE_USD)
        throw new Error("Existing budget exceeded");
    } catch (error) {
      rmdirSync(this.lock);
      throw error;
    }
  }
  private append(entry: Entry) {
    const fd = openSync(this.path, "a");
    try {
      writeSync(fd, JSON.stringify(entry) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.entries.push(entry);
  }
  get reservations() {
    return this.entries.filter((e): e is Reservation => e.kind === "reserve");
  }
  total() {
    return this.reservations.reduce((sum, r) => {
      const settled = this.entries.find(
        (e): e is Settlement => e.kind === "settle" && e.id === r.id,
      );
      return sum + (settled?.estimatedUsd ?? r.reservedUsd);
    }, 0);
  }
  reserve(caseId: string, payload: string) {
    const envelope = reservationFor(payload);
    if (
      this.reservations.length >= MAX_REQUESTS ||
      this.total() + envelope.reservedUsd > ALLOWANCE_USD
    )
      throw new Error("Evaluation allowance exhausted");
    const entry: Reservation = {
      kind: "reserve",
      id: this.reservations.length + 1,
      caseId,
      at: new Date().toISOString(),
      ...envelope,
    };
    this.append(entry);
    return entry;
  }
  settle(
    id: number,
    data: Omit<Settlement, "id" | "kind" | "estimatedUsd"> & { usage?: Usage },
  ) {
    const prior = this.reservations.find((r) => r.id === id);
    if (!prior || this.entries.some((e) => e.kind === "settle" && e.id === id))
      throw new Error("Invalid settlement");
    const estimatedUsd = data.usage ? usageCost(data.usage, prior) : undefined;
    this.append({ ...data, kind: "settle", id, estimatedUsd });
  }
  close() {
    rmdirSync(this.lock);
  }
}
