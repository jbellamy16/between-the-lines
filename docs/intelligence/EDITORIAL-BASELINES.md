# Deterministic editorial baselines B1 and B2

October 12, 2026. Implements the offline baseline step of the [investigator proposal](AGENTIC-INVESTIGATOR-PROPOSAL.md), using the [shared evidence catalogue](EVIDENCE-DISCOVERY.md). **No Foundry investigator, provider calls, public activation or deployment.** Production still uses its existing policy. These are opt-in server-only evaluation functions.

## Result and decision

On 12 authored development cases, both new policies meet 12/12 lead-selection labels; the complete production baseline meets 11/12. The one difference is editorial: prefer the opponent's continuing increase over a favored team's fading increase. All measurements, competing descriptions and qualifications already exist in deterministic code. **Zero additional football facts and no measured model intelligence or human preference.**

Choose **B2 as the provisional development champion**: it matches B1's selected stories, complete assessments and guided answers with fewer evidence-bundle reads. Retain B1 as the exhaustive reference and compare any future investigator against both. The strongest result here is that code already makes sufficient decisions for these cases; it does not establish a reason to add inference.

## Implementation and shared boundary

`src/lib/ai/director/editorial-baselines.ts` exports:

- `runEditorialBaseline(match, cutoff, "B1" | "B2", context?, storyLimit = 1)`: returns a decision receipt, verified existing `BroadcastStory` objects, complete guided answers and measured local work.
- `verifyEditorialBaseline(match, cutoff, context, decision)`: rebuilds the canonical catalogue, replays the policy and reads, compares the complete receipt, independently recomputes selected hypotheses, validates the editorial plan and uses the existing renderer.
- `editorialPriority(index, development)`: exposes each component of the fixed objective. Scores are editorial points, not confidence, significance or probabilities.

The policy itself receives only `EvidenceIndex` and the ID-only reader. It never receives raw events, case IDs, expected labels or future records. Canonical source access belongs to discovery and independent verification. `createEvidenceReader` adds request-local memoization to discovery, with a private canonical snapshot and copies on both index and response boundaries. A fresh reader is required for verification; reuse cannot conceal a later source revision. The original `executeEvidenceOption` continues to reconstruct the current canonical prefix on each call.

Discovery version `evidence-discovery-1.1.0` adds policy-neutral editorial metadata: existing lead eligibility, equivalent/overlapping development IDs, seen-evidence count and the number of claim events involving the preferred recorded actor. It exposes no seen-event ID list. These fields and the reader are available identically to B1, B2 and any future investigator. Both arms pay for the same initial catalogue computation and use the same memoization.

The selection universe is the advertised bounded **development list**. B1 also evaluates every advertised scope; scope-tool results cannot silently create policy-exclusive selectable developments. Some underlying tools can return derived claims beyond that list. Promoting such claims into a future selection universe requires a shared catalogue change for every arm, including new complete-assessment options. Neither baseline gets arbitrary windows or additional source access. No unlimited-football-analysis claim is made.

### B1: exhaustive evaluation

B1 reads each available advertised option exactly once, including team/player aggregates, equal-window comparisons, routes, possessions, targeted assessments and guided answers. It records unavailable options and bounded-response failures. It then applies the common objective and selects verified, distinct developments with their whole support/challenge bundles. Returned scope calculations and assessments are hashed in the replayable trace; extra scope reads cannot manufacture a different verdict when the shared summaries already settle it.

The finite catalogue can contain up to 96 options. B1's cheap local enumeration is not artificially limited to the future model's four-tool allowance and is not charged as inference. Exhaustion is deliberate reference work; B2 is the optimized implementation when the same answer needs less retrieval.

### B2: adaptive deterministic policy

1. Rank every advertised development using the common objective, including those outside the production shortlist. Respect category preferences and suppress wholly seen non-score developments.
2. Retrieve the best eligible development's complete, precisely targeted assessment. Reject an absent, unsupported, failed or incomplete assessment and consider the next eligible development. Never replace unavailable mandatory score context with a lower-priority football claim.
3. Retrieve complete guided evidence for the selected development. Prefer the shot-surge bundle because it may contain quality, opponent and fading answers. Inspect the returned bundle's actual nested intents before deciding which remaining queries are needed; do not request covered answers again.
4. Preserve unknown answers and partial route coverage. Repeating a read cannot recover missing source xG, possession identity or precise timing. An unavailable mandatory bundle prevents selection; a delivered narrower answer with explicit unknowns remains publishable and unresolved.
5. Stop when the requested distinct story set has complete mandatory bundles. Remaining options cannot change the fixed ordering because its inputs are already supplied in the index. Quiet, wholly seen and category-filtered states need no reads. Additional story slots apply the same overlap and equivalence exclusions.

This is intentionally honest about the foundation's strength: the index already computes hypotheses, competing interpretations and guided verdicts. B2 adapts evidence delivery and sufficiency, not hidden football arithmetic. Do not hide those summaries from a future model or weaken this policy to create apparent discovery.

### Fixed objective and safeguards

| Component                 | Development policy                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Materiality               | Score/full-time 1,000; comparisons 30 plus up to 12 for count change; shot-origin change 28; recovery-to-shot 24; other categories 16. Existing lead eligibility remains mandatory. |
| Recency                   | Up to 8 points, decreasing linearly over the existing 900-second recent scope.                                                                                                      |
| Novelty                   | Up to 16 points for unseen claim evidence; wholly seen non-score claims are ineligible.                                                                                             |
| Preferences               | 6 for the preferred team, 6 for actual preferred-actor evidence; analyst comparison bonus 1. Category choices filter eligibility.                                                   |
| Completeness              | Up to 8 points deducted for reported missing information and unavailable guided answers. Unknowns never become zero measurements.                                                   |
| Counter-evidence          | Up to 8 deducted for contradictory evidence, 8 for a fading increase and 2 for opponent improvement. All challenges remain attached.                                                |
| Competing interpretations | 2 when an existing registered interpretation is supported; all supported, unresolved and unsupported alternatives remain in the complete answer.                                    |
| Ties and duplication      | Score, exact event recency, stable ID. Existing editorial groups and evidence overlap exclude equivalent stories.                                                                   |

Foreground order highlights fading, opponent improvement, unavailable/non-improving quality and the competing-description question when applicable. It is a typed editorial sidecar, not new factual prose or a UI change. The complete answers and mandatory qualifications remain intact regardless of foreground order.

Stops are `sufficient`, `no-material-gain` or `unresolved`, with deterministic origin and explicit `available-bounded-catalogue` scope. Omitted catalogue developments/options and rejected mandatory bundles prevent a sufficient stop. Observer and scope-cap omissions remain disclosed separately. General off-ball/intent limitations remain in the assessment; they do not make an otherwise complete descriptive answer unresolved. Provider completeness is always unknown.

Score context, exact cutoff, source revision/digest, source restrictions, same-period comparisons, 1,800-second windows, 20,000-character whole assessments, 48,000-character responses and 40 displayed events remain enforced. No mandatory qualification is trimmed to fit. Story schema 1.1.0, arithmetic, renderer, provider controls and production fallback remain unchanged. Verification rejects modified selections, scores, stops, omitted question receipts, duplicated trace entries and stale cutoffs/preferences/revisions.

The new reader is not a model orchestration ledger. A future integration must retain the existing shared tool/attempt, deadline, cancellation and spending limits around every read. No such integration is implemented here.

## Development evaluation

Inputs and independent authored decision labels live in `eval/editorial-baselines/cases.ts`; mechanics, arithmetic checks and scoring live in `tests/editorial-baselines.test.ts`. Reproduce with `AI_ENABLED=false npm run eval:editorial`. The run writes `artifacts/editorial-baselines/development.json`; the checked-in [result snapshot](EDITORIAL-BASELINES-DEVELOPMENT.json) includes per-case outcomes, input/source hashes, complete read traces and local timing breakdowns.

A is the actual production `directMatch` offline result, supplemented with **all existing guided answers** for its selected story. It retains its existing assessments, routes, storyline/novelty rules and fallback; it is not the historical seven-fact ablation. All arms use one story and the same fan renderer. Baseline functions also support up to three distinct stories, tested separately; extra output length earns no evaluation credit.

The labels ask for an existing shot-increase development, except goal/abstention controls. The paired temporal cases hold totals at Harbor 2 → 6 and Riverside 1 → 5. Harbor's current-window halves change from 3 → 3 to 5 → 1; Riverside stays 2 → 3. Independent event-tuple counting verifies these figures without calling the production comparison predicates. Preferences are held fixed in that pair. Other cases vary explicit team/player preference, seen evidence, xG, possession, timing, score or category filters.

| Case                               | A lead    | B1 / B2 lead | B1 / B2 local reads | B1 / B2 stop     |
| ---------------------------------- | --------- | ------------ | ------------------- | ---------------- |
| Spread, Harbor preferred           | Harbor    | Harbor       | 34 / 2              | Sufficient       |
| Fading, Harbor preferred           | Harbor    | Riverside    | 34 / 2              | Sufficient       |
| Opponent preferred                 | Riverside | Riverside    | 34 / 2              | Sufficient       |
| Harbor evidence already seen       | Riverside | Riverside    | 34 / 2              | Sufficient       |
| Harbor player preferred            | Harbor    | Harbor       | 34 / 2              | Sufficient       |
| Missing quality                    | Harbor    | Harbor       | 34 / 2              | Unresolved       |
| Missing possession                 | Harbor    | Harbor       | 21 / 2              | Unresolved       |
| Minute precision                   | Harbor    | Harbor       | 34 / 2              | Unresolved       |
| Quiet                              | Abstain   | Abstain      | 9 / 0               | No material gain |
| Insufficient early-half window     | Abstain   | Abstain      | 5 / 0               | No material gain |
| Goal overrides opponent preference | Goal      | Goal         | 26 / 1              | Sufficient       |
| Rhythm-only category preference    | Abstain   | Abstain      | 34 / 0              | No material gain |

| Measure                                          | A: production                | B1: exhaustive   | B2: adaptive   |
| ------------------------------------------------ | ---------------------------- | ---------------- | -------------- |
| Correct lead/abstention label                    | 11/12                        | 12/12            | 12/12          |
| Authored relevance utility                       | 34/36                        | 36/36            | 36/36          |
| Mandatory challenge/qualification items retained | 180/180                      | 180/180          | 180/180        |
| Missing-data cases handled                       | 3/3                          | 3/3              | 3/3            |
| Local registered-option reads                    | 0 (direct calculations)      | 333              | 17             |
| Fresh replay reads, separately measured          | Existing production verifier | 333              | 17             |
| Duplicate option IDs investigated                | 0                            | 0                | 0              |
| Reads beyond authored sufficient evidence set    | Not comparable               | 316              | 0              |
| Correct reported stop outcome                    | Not instrumented             | 12/12            | 12/12          |
| Earliest authored evidence frontier              | Not instrumented             | 0/12             | 12/12          |
| Median / nearest-rank p95 elapsed                | 0.68 / 4.95 ms               | 10.19 / 20.61 ms | 4.35 / 5.42 ms |
| Provider requests / inference charges            | 0 / $0                       | 0 / $0           | 0 / $0         |

Relevance is an authored ordinal utility: 3 for the expected lead/abstention, 1 for another verified development, 0 for a missed development. It is not a human rating. Mandatory coverage compares complete evidence items and qualification text/references with the canonical existing assessments and questions; it measures preservation, not independent football adjudication. Missing-data handling requires null/unknown quality or incomplete route evidence, not simply a stop label.

The authored frontier is two reads for a shot-increase answer (whole assessment plus whole nested question bundle), one for the goal, zero for the three no-material-gain controls. B1 deliberately exhausts the catalogue; its 316 excess reads are non-contributory to this fixed objective, not duplicated option IDs or wasted paid requests. B1/B2 equality after exhaustive enumeration corroborates sufficiency on these inputs. Verification reads are necessary safety work and excluded from redundant-investigation counts.

Timings are one local Node v26.8.2 run over 12 cases, fixed A/B1/B2 order, no network. B1/B2 elapsed includes initial indexing, policy execution, fresh canonical replay and story/answer packaging. A includes its normal fallback and existing guided computations. There is no artificial token/tool price. OS scheduling, warm-up and ordering can affect these small timings; they are not deployment latency, a statistically controlled benchmark or a hosted-compute dollar estimate.

## Limits and next decision

These 12 states are closely related development fixtures, not 12 independent matches. They were used while implementing the policy. The proposed 36-slot holdout, real-match generalization, blinded editorial adjudication and human preference remain **unmeasured and unfrozen**. No model arm ran. The historical hash-locked offline corpus is unchanged; its 35/35 deterministic fact result remains covered by the full regression suite.

The shared index can omit candidates to fit its envelope. Selection covers only advertised verified developments, and existing observer/player/sequence limits still apply. Additional contract tests exercise a selected development outside the production shortlist, withheld catalogue entries, evidence outside the time bound, exact fractional cutoffs, future/raw-metadata invariance, restricted sources, altered receipts and multiple-story deduplication. These are safety checks outside the 12-case denominator.

The sole labeled improvement is which existing verified story leads when a favored increase fades. It contributes no new football fact. The other eleven production decisions are already sufficient under this rubric; B1/B2 also resolve the delivery/stopping choices without inference. Retain B2 as the provisional deterministic champion and require future comparisons to beat both baselines with a separate held-out and human-reviewed study. This PR does not begin that investigator or authorize such a study.

## Review and validation

PR #38 was reviewed across its implementation, coverage contracts and tests. All four GitHub checks passed, no review comments/change requests were present, and 59 focused local tests passed. No blocking finding remained. Its exact head `106e7aaa531012cc9decec9680c591993b2c7de0` was squash-merged, then origin was fetched. This branch starts at synchronized main `bf45327f2964aec30e275ed15f381c629a440bce` in an isolated worktree. The existing local `next-env.d.ts` edit is preserved in the original checkout.

Validation: TypeScript passed; 715 unit tests passed with six environment-dependent skips, including 11 new baseline tests and the 22 discovery tests; production build passed; 36 Director/guided browser regressions passed across desktop, Android-sized and iPhone-sized Chromium views. Formatting and whitespace checks passed. The initial build rejected an external dependency symlink; installing dependencies locally in the isolated worktree resolved it. No application workaround was added.
