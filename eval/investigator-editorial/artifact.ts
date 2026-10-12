import type { Evaluation, Explanation } from "./render";
import { investigatorDigest } from "../../src/lib/ai/director/investigator-contract";
import { explanationLabels } from "../../src/lib/explanation";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Share HTML only. The separate key/audit must be withheld from reviewers. */
export function blindedArtifact(
  result: Evaluation,
  pairId: string,
  reverse: boolean,
) {
  if (result.status !== "reviewable")
    throw new Error(
      "Both arms must fit the shared limit; no truncation permitted",
    );
  const arms = reverse
    ? [result.investigator, result.b2]
    : [result.b2, result.investigator];
  const render = (e: Explanation, i: number) =>
    `<article aria-label="Explanation ${i ? "B" : "A"}"><h2>Explanation ${i ? "B" : "A"}</h2><h3>${escape(e.headline)}</h3><section aria-label="Editorial focus ${i ? "B" : "A"}">${e.emphasis.map((b) => `<p><strong>${escape(b.role)}:</strong> ${escape(b.text)}</p>`).join("")}</section><section aria-label="Complete explanation ${i ? "B" : "A"}">${e.mandatory.map((b) => `<p><strong>${escape(b.role)}:</strong> ${escape(b.text)}</p>`).join("")}</section><footer>${e.words} words · ${e.limit} word limit</footer></article>`;
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Explanation comparison ${escape(pairId)}</title><style>body{font:16px/1.6 system-ui;color:#172333;background:#f4f6f8;max-width:1500px;margin:32px auto;padding:0 24px}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:white;padding:24px;border:1px solid #b8c3ce;border-radius:10px;min-width:0;overflow-wrap:anywhere}section[aria-label^="Editorial focus"]{border-left:4px solid #345b72;padding:0 16px}footer{color:#4a5764}textarea{display:block;width:95%;min-height:100px}label{display:block;margin:16px 0}@media(max-width:700px){main{grid-template-columns:1fr}}@media print{body{margin:0;font-size:10pt}article{border:1px solid #888;break-inside:auto}textarea{min-height:60px}}</style><header><h1>Explanation comparison ${escape(pairId)}</h1><p>${escape(explanationLabels[result.b2.style])} · ${result.b2.length} · same maximum length for both explanations</p><p>Compare clarity, useful prioritization and treatment of uncertainty. Different ordering alone is not evidence of improvement. Choose a tie when appropriate.</p></header><main>${arms.map(render).join("")}</main><section aria-label="Human review"><h2>Your assessment</h2><p>Preference: A / B / Tie / Cannot assess. Record your answer separately or print this page; entries here are not saved.</p><label>Which emphasis helped, and why? Cite exact wording from both explanations.<textarea></textarea></label><label>Was relevant evidence or uncertainty less visible? Identify any regression.<textarea></textarea></label></section></html>`;
  return {
    html,
    key: {
      pairId,
      A: reverse ? "investigator" : "B2",
      B: reverse ? "B2" : "investigator",
      artifactDigest: investigatorDigest(html),
      comparison: result.comparison,
    },
  };
}
