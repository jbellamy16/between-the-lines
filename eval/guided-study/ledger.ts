import { createHash } from "node:crypto";
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
import { z } from "zod";
import { responseReceiptSchema } from "./response-receipt";

export const STUDY = "guided-foundry-2026-10-11";
export const DEPLOYMENT = "between-the-lines-gpt54-mini";
export const CAPS = {
  workflows: 6,
  attempts: 12,
  perWorkflow: 3,
  nanoUsd: 500_000_000,
  spacingMs: 65_000,
} as const;
export const PRICE = { input: 0.75, cachedInput: 0.075, output: 4.5 } as const;
// Reserve the ENTIRE documented 400,000-token context at the uncached rate,
// plus the full output allowance. This even exceeds Microsoft's 272,000 input
// maximum. It covers framing/tools without relying on a bytes/token heuristic.
export const ENVELOPE = {
  input: 400_000,
  output: 1_800,
  nanoUsd: 308_100_000,
} as const;
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const integer = z.number().int().nonnegative().safe();
export const usageSchema = z
  .object({
    input_tokens: integer.max(ENVELOPE.input),
    output_tokens: integer.max(ENVELOPE.output),
    input_tokens_details: z.object({ cached_tokens: integer }).optional(),
  })
  .refine(
    (u) => (u.input_tokens_details?.cached_tokens ?? 0) <= u.input_tokens,
  );
export type Usage = z.infer<typeof usageSchema>;
// Integer nanodollars avoid floating point budget comparisons. Cached discounts
// are reported separately; accounting deliberately prices ALL input uncached.
export function costs(raw: unknown) {
  const usage = usageSchema.parse(raw);
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  return {
    usage,
    reportedRateNanoUsd:
      (usage.input_tokens - cached) * 750 +
      cached * 75 +
      usage.output_tokens * 4500,
    accountedNanoUsd: usage.input_tokens * 750 + usage.output_tokens * 4500,
  };
}
const outcome = z.enum(["completed", "abstained", "failed"]);
const reason = z.enum([
  "blocked_preflight",
  "workflow_limit",
  "attempt_limit",
  "spend_limit",
  "workflow_attempt_limit",
  "accounting",
  "cancelled",
  "timeout",
  "transport",
  "invalid_response",
  "terminal_http",
  "verification",
  "runtime_failure",
  "complete",
]);
const eventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("init"),
      study: z.literal(STUDY),
      manifest: z.string().regex(/^[a-f0-9]{64}$/),
      caps: z.literal(JSON.stringify(CAPS)),
      envelope: z.literal(JSON.stringify(ENVELOPE)),
    })
    .strict(),
  z
    .object({ kind: z.literal("begin"), caseId: z.string(), at: integer })
    .strict(),
  z
    .object({
      kind: z.literal("reserve"),
      id: integer.positive(),
      caseId: z.string(),
      at: integer,
      bytes: integer.positive().max(131072),
      payloadDigest: z.string().regex(/^[a-f0-9]{64}$/),
      nanoUsd: z.literal(ENVELOPE.nanoUsd),
    })
    .strict(),
  z.object({ kind: z.literal("dispatch"), id: integer.positive() }).strict(),
  z
    .object({
      kind: z.literal("settle"),
      id: integer.positive(),
      at: integer,
      status: integer.max(599).optional(),
      retryAfterMs: integer.optional(),
      latencyMs: integer.optional(),
      editorial: responseReceiptSchema.optional(),
      responseStatus: z.enum([
        "completed",
        "incomplete",
        "other",
        "unavailable",
      ]),
      usage: usageSchema.optional(),
      reportedRateNanoUsd: integer.optional(),
      accountedNanoUsd: integer,
    })
    .strict(),
  z
    .object({
      kind: z.literal("end"),
      caseId: z.string(),
      at: integer,
      outcome,
    })
    .strict(),
  z.object({ kind: z.literal("stop"), reason }).strict(),
]);
type Event = z.infer<typeof eventSchema>;
type Reserve = Extract<Event, { kind: "reserve" }>;
type Settle = Extract<Event, { kind: "settle" }>;
const lineSchema = z
  .object({ previous: z.string(), event: eventSchema, hash: z.string() })
  .strict();

/** Study-only, single-writer, append-only journal. It never replaces application
 * accounting. Unknown usage and dispatch ambiguity retain the full reserve.
 * A crash leaves a lock; corruption/stale locks require human diagnosis. */
export class StudyLedger {
  private events: Event[] = [];
  private hash = "";
  private closed = false;
  private poisoned = false;
  constructor(
    readonly path: string,
    readonly manifest: string,
  ) {
    mkdirSync(dirname(path), { recursive: true });
    mkdirSync(`${path}.lock`);
    try {
      if (!existsSync(path)) {
        const fd = openSync(path, "wx", 0o600);
        closeSync(fd);
        this.append({
          kind: "init",
          study: STUDY,
          manifest,
          caps: JSON.stringify(CAPS),
          envelope: JSON.stringify(ENVELOPE),
        });
        const parent = openSync(dirname(path), "r");
        try {
          fsyncSync(parent);
        } finally {
          closeSync(parent);
        }
      } else {
        const raw = readFileSync(path, "utf8");
        if (!raw.endsWith("\n")) throw new Error("Incomplete study ledger");
        for (const line of raw.trimEnd().split("\n")) {
          const entry = lineSchema.parse(JSON.parse(line));
          if (
            entry.previous !== this.hash ||
            entry.hash !== digest(this.hash + JSON.stringify(entry.event))
          )
            throw new Error("Corrupt study ledger");
          this.validate(entry.event);
          this.events.push(entry.event);
          this.hash = entry.hash;
        }
        if (
          !this.events.length ||
          this.active ||
          this.reservations.some(
            (r) => !this.settlements.some((s) => s.id === r.id),
          )
        )
          throw new Error("Unresolved prior execution; retain reservations");
      }
    } catch (error) {
      rmdirSync(`${path}.lock`);
      throw error;
    }
  }
  get reservations() {
    return this.events.filter((e): e is Reserve => e.kind === "reserve");
  }
  get settlements() {
    return this.events.filter((e): e is Settle => e.kind === "settle");
  }
  get workflows() {
    return this.events.filter((e) => e.kind === "begin");
  }
  get dispatched() {
    return this.events.filter((e) => e.kind === "dispatch").length;
  }
  get stopped() {
    return this.events.findLast((e) => e.kind === "stop");
  }
  get active() {
    const last = this.events.findLast(
      (e) => e.kind === "begin" || e.kind === "end",
    );
    return last?.kind === "begin" ? last.caseId : undefined;
  }
  totalNanoUsd() {
    return this.reservations.reduce(
      (sum, r) =>
        sum +
        (this.settlements.find((s) => s.id === r.id)?.accountedNanoUsd ??
          r.nanoUsd),
      0,
    );
  }
  private validate(e: Event) {
    if (this.closed || this.poisoned)
      throw new Error("Closed/unwritable study ledger");
    eventSchema.parse(e);
    if (e.kind === "init") {
      if (this.events.length || e.manifest !== this.manifest)
        throw new Error("Wrong frozen study");
      return;
    }
    if (!this.events.length) throw new Error("Missing study header");
    if (this.stopped && !["settle", "end"].includes(e.kind))
      throw new Error("Study stopped");
    if (e.kind === "begin") {
      const previous = this.events.findLast((v) => v.kind === "end");
      if (
        this.active ||
        this.workflows.length >= CAPS.workflows ||
        this.workflows.some(
          (w) => w.kind === "begin" && w.caseId === e.caseId,
        ) ||
        (previous?.kind === "end" && e.at < previous.at + CAPS.spacingMs)
      )
        throw new Error("Workflow refused");
    }
    if (e.kind === "reserve") {
      if (
        this.active !== e.caseId ||
        e.id !== this.reservations.length + 1 ||
        this.reservations.length >= CAPS.attempts ||
        this.reservations.filter((r) => r.caseId === e.caseId).length >=
          CAPS.perWorkflow ||
        this.totalNanoUsd() + e.nanoUsd > CAPS.nanoUsd
      )
        throw new Error("Reservation refused");
      if (
        this.reservations.some(
          (r) => !this.settlements.some((s) => s.id === r.id),
        )
      )
        throw new Error("Concurrent or unaccounted dispatch");
    }
    if (e.kind === "dispatch" || e.kind === "settle") {
      const reservation = this.reservations.find((r) => r.id === e.id);
      if (
        !reservation ||
        reservation.caseId !== this.active ||
        this.events.some((v) => v.kind === e.kind && "id" in v && v.id === e.id)
      )
        throw new Error("Invalid request accounting");
      if (e.kind === "settle") {
        if (!this.events.some((v) => v.kind === "dispatch" && v.id === e.id))
          throw new Error("Unsent settlement");
        const expected = e.usage
          ? costs(e.usage)
          : {
              accountedNanoUsd: ENVELOPE.nanoUsd,
              reportedRateNanoUsd: undefined,
            };
        if (
          e.accountedNanoUsd !== expected.accountedNanoUsd ||
          e.reportedRateNanoUsd !== expected.reportedRateNanoUsd
        )
          throw new Error("Invalid usage accounting");
      }
    }
    if (
      e.kind === "end" &&
      (e.caseId !== this.active ||
        (e.outcome !== "failed" &&
          this.reservations.some(
            (r) => !this.settlements.some((s) => s.id === r.id),
          )))
    )
      throw new Error("Incomplete workflow accounting");
  }
  private append(e: Event) {
    this.validate(e);
    const event = eventSchema.parse(e),
      hash = digest(this.hash + JSON.stringify(event));
    const bytes = Buffer.from(
      JSON.stringify({ previous: this.hash, event, hash }) + "\n",
    );
    const fd = openSync(this.path, "a");
    try {
      for (let offset = 0; offset < bytes.length;)
        offset += writeSync(fd, bytes, offset, bytes.length - offset);
      fsyncSync(fd);
    } catch (error) {
      this.poisoned = true;
      throw error;
    } finally {
      closeSync(fd);
    }
    this.events.push(event);
    this.hash = hash;
  }
  begin(caseId: string, at = Date.now()) {
    if (this.workflows.length >= CAPS.workflows) this.refuse("workflow_limit");
    this.append({ kind: "begin", caseId, at });
  }
  reserve(payload: string) {
    const body = JSON.parse(payload);
    // Plain text Responses only: no remote retrieval, conversation expansion,
    // built-in paid tools, images, audio, background work or implicit truncation.
    const allowed = [
      "instructions",
      "input",
      "parallel_tool_calls",
      "tools",
      "tool_choice",
      "text",
      "model",
      "store",
      "max_output_tokens",
    ];
    if (
      Object.keys(body).some((k) => !allowed.includes(k)) ||
      body.model !== DEPLOYMENT ||
      body.store !== false ||
      body.max_output_tokens !== ENVELOPE.output ||
      body.parallel_tool_calls !== false ||
      !Array.isArray(body.input) ||
      body.tools?.some((t: { type: string }) => t.type !== "function")
    )
      this.refuse("accounting");
    if (this.reservations.length >= CAPS.attempts) this.refuse("attempt_limit");
    if (
      this.reservations.filter((r) => r.caseId === this.active).length >=
      CAPS.perWorkflow
    )
      this.refuse("workflow_attempt_limit");
    if (this.totalNanoUsd() + ENVELOPE.nanoUsd > CAPS.nanoUsd)
      this.refuse("spend_limit");
    const e: Reserve = {
      kind: "reserve",
      id: this.reservations.length + 1,
      caseId: this.active ?? "",
      at: Date.now(),
      bytes: Buffer.byteLength(payload),
      payloadDigest: digest(payload),
      nanoUsd: ENVELOPE.nanoUsd,
    };
    this.append(e);
    return e;
  }
  dispatch(id: number) {
    this.append({ kind: "dispatch", id });
  }
  settle(
    id: number,
    data: Pick<
      Settle,
      | "status"
      | "retryAfterMs"
      | "responseStatus"
      | "usage"
      | "latencyMs"
      | "editorial"
    >,
  ) {
    this.append({
      kind: "settle",
      id,
      at: Date.now(),
      ...data,
      ...(data.usage
        ? costs(data.usage)
        : { accountedNanoUsd: ENVELOPE.nanoUsd }),
    });
  }
  end(result: z.infer<typeof outcome>, at = Date.now()) {
    this.append({
      kind: "end",
      caseId: this.active ?? "",
      outcome: result,
      at,
    });
  }
  stop(why: z.infer<typeof reason>) {
    if (!this.stopped) this.append({ kind: "stop", reason: why });
  }
  refuse(why: z.infer<typeof reason>): never {
    this.stop(why);
    throw new Error(`Study refused: ${why}`);
  }
  close() {
    if (!this.closed) {
      this.closed = true;
      rmdirSync(`${this.path}.lock`);
    }
  }
}
