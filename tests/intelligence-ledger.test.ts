import { it, expect } from "vitest";
import {
  mkdtempSync,
  appendFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EvaluationLedger,
  DEPLOYMENT,
  reservationFor,
} from "../eval/intelligence-ledger";

const payload = JSON.stringify({
  model: DEPLOYMENT,
  store: false,
  max_output_tokens: 1800,
  input: "test",
});
function temp(run: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "btl-budget-"));
  try {
    run(join(dir, "ledger.jsonl"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
it("retains unresolved reservations across restarts and rejects concurrent writers", () =>
  temp((path) => {
    const a = new EvaluationLedger(path);
    a.reserve("crash", payload);
    expect(() => new EvaluationLedger(path)).toThrow();
    const before = a.total();
    a.close();
    const b = new EvaluationLedger(path);
    expect(b.total()).toBe(before);
    expect(b.reservations).toHaveLength(1);
    b.close();
  }));
it("stops at 60 requests even when returned token usage is zero", () =>
  temp((path) => {
    const ledger = new EvaluationLedger(path);
    for (let i = 0; i < 60; i++) {
      const r = ledger.reserve("test", payload);
      ledger.settle(r.id, { usage: { input_tokens: 0, output_tokens: 0 } });
    }
    expect(() => ledger.reserve("61", payload)).toThrow(/allowance/);
    ledger.close();
    const resumed = new EvaluationLedger(path);
    expect(() => resumed.reserve("retry", payload)).toThrow(/allowance/);
    resumed.close();
  }));
it("stops before the money cap with unknown usage and never refunds failed requests", () =>
  temp((path) => {
    const ledger = new EvaluationLedger(path),
      large = JSON.stringify({
        model: DEPLOYMENT,
        store: false,
        max_output_tokens: 1800,
        input: "x".repeat(130000),
      });
    while (ledger.total() + reservationFor(large).reservedUsd <= 2) {
      const r = ledger.reserve("failed", large);
      ledger.settle(r.id, { status: 429 });
    }
    expect(ledger.total()).toBeLessThanOrEqual(2);
    expect(() => ledger.reserve("overflow", large)).toThrow(/allowance/);
    ledger.close();
  }));
it("fails closed on corrupt journals, wrong budgets and impossible usage", () =>
  temp((path) => {
    const ledger = new EvaluationLedger(path),
      r = ledger.reserve("x", payload);
    for (const usage of [
      { input_tokens: -1, output_tokens: 1 },
      { input_tokens: 10, output_tokens: 1801 },
      {
        input_tokens: 1,
        output_tokens: 1,
        input_tokens_details: { cached_tokens: 2 },
      },
    ])
      expect(() => ledger.settle(r.id, { usage })).toThrow();
    expect(ledger.total()).toBe(r.reservedUsd);
    ledger.close();
    const original = readFileSync(path, "utf8");
    appendFileSync(path, "{");
    expect(() => new EvaluationLedger(path)).toThrow();
    writeFileSync(
      path,
      original.replace('"allowanceUsd":2', '"allowanceUsd":200'),
    );
    expect(() => new EvaluationLedger(path)).toThrow();
  }));
it("refuses wrong deployments and unsafe request envelopes", () => {
  for (const body of [
    { model: "other", store: false, max_output_tokens: 1800 },
    { model: DEPLOYMENT, store: true, max_output_tokens: 1800 },
    { model: DEPLOYMENT, store: false, max_output_tokens: 1801 },
    {
      model: DEPLOYMENT,
      store: false,
      max_output_tokens: 1800,
      input: "x".repeat(131072),
    },
  ])
    expect(() => reservationFor(JSON.stringify(body))).toThrow();
});
