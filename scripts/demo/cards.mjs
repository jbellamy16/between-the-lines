// Build presentation cards from original study receipts; never call a provider.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const out = "docs/demo-2026-10-12/assets";
const source = "docs/intelligence/guided-foundry-2026-10-11/results.json";
const raw = await fs.readFile(source);
const results = JSON.parse(raw);
const row = results.rows.find((r) => r.caseId === "fading-increase");
const plan = results.settlements.find((s) =>
  s.editorial.plans.some((p) => p.intent === "fading-activity"),
).editorial.plans[0];
assert.equal(row.result.source, "foundry");
assert.equal(row.result.evidence.verdict, "lower");
assert.equal(plan.verdict, "lower");
assert.equal(results.rows.filter((r) => r.outcome === "completed").length, 5);
assert.equal(results.rows.filter((r) => r.outcome === "abstained").length, 1);
assert.equal(results.actualHttpAttempts, 5);
assert.ok(
  results.rows.every(
    (r) =>
      r.comparison.sameConclusionAndCoreEvidence &&
      r.comparison.addedEvidence.length === 0,
  ),
);
assert.ok(
  results.rows.every(
    (r) =>
      r.verification.canonicalEvidenceIdentical &&
      r.verification.independentArithmetic &&
      r.verification.allReferencesVisible,
  ),
);
assert.ok(
  results.settlements.every((s) => s.editorial.toolChoices.length === 0),
);
const style = `<style>*{box-sizing:border-box}body{margin:0;background:#101c28;color:#f3f6f9;font:28px Arial,sans-serif;padding:65px 82px;width:1600px;height:790px}header{color:#a5e3b6;font-size:23px;letter-spacing:3px;text-transform:uppercase}h1{font-size:57px;letter-spacing:-1.8px;margin:28px 0 36px}h2{font-size:31px;margin:0 0 20px;color:#a5e3b6}p{line-height:1.4;margin:16px 0}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}.box{background:#1c2c3d;border:1px solid #456078;border-radius:18px;padding:28px;min-height:240px}.note{margin-top:34px;color:#d9e3ed;font-size:25px}footer{position:absolute;bottom:42px;font-size:21px;color:#bdcddb}code{font-size:24px;color:#a5e3b6}.wide{grid-template-columns:1.1fr 1fr}.big{font-size:48px;font-weight:bold;margin:0 0 20px}.small{font-size:22px;color:#bdcddb}</style>`;
const cards = {
  "foundry-role": `<header>Implementation • Optional Microsoft Foundry path</header><h1>The model selects. The application checks.</h1><div class="grid"><section class="box"><h2>1 · Application evidence</h2><p>Events up to the match clock</p><p>Counts, windows, event references and limits</p></section><section class="box"><h2>2 · Foundry model</h2><p>GPT-5.4 Mini via Azure Responses</p><p>Structured answer selection; optional bounded evidence queries</p></section><section class="box"><h2>3 · Application checks</h2><p>Recompute and validate</p><p>Controlled factual wording or deterministic fallback</p></section></div><p class="note">Explanation levels and pitch replay run locally. The filmed app makes no model calls.</p><footer>Architecture illustration • No Foundry Agent Service or multi-agent orchestration claim</footer>`,
  "foundry-receipt": `<header>Historical Microsoft Foundry result • October 11, 2026 • Not live</header><h1>Verified answers. No proven additional benefit.</h1><div class="grid wide"><section class="box"><h2>Same fading question · 70:00</h2><p>Application retrieval → model selection → checks</p><p><code>intent: fading-activity<br>verdict: lower<br>supplementIds: []</code></p><p class="small">1 model request · 0 optional follow-ups<br>Application rendered the answer from checked events.</p></section><section class="box"><p class="big">5 answers · 1 no-call</p><p>All five model answers matched the deterministic baseline.</p><p>No optional follow-ups selected.</p><p>Human usefulness remains unmeasured.</p></section></div><p class="note">Small synthetic/diagnostic study. Does not validate today's shot-surge workflow.</p><footer>Original receipts: guided-foundry-2026-10-11/results.json • Evaluated commit ${results.evaluatedCommit.slice(0, 7)}</footer>`,
};
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 790 },
  });
  for (const [name, body] of Object.entries(cards)) {
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${name}</title>${style}<body>${body}</body></html>`;
    await fs.writeFile(`${out}/${name}.html`, html);
    await page.setContent(html);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  `${out}/foundry-provenance.json`,
  JSON.stringify(
    {
      source,
      sha256: createHash("sha256").update(raw).digest("hex"),
      evaluatedCommit: results.evaluatedCommit,
      caseId: row.caseId,
      modelPlan: plan,
      actualHttpAttempts: results.actualHttpAttempts,
      completed: 5,
      noCall: 1,
      optionalFollowups: 0,
      live: false,
      scope:
        "Historical synthetic/diagnostic campaign; not a current workflow evaluation",
    },
    null,
    2,
  ) + "\n",
);
