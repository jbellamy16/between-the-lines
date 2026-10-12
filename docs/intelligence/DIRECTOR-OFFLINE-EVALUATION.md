# Director evaluation: offline comparison

**Later audit update:** The [readiness candidate](../readiness-2026-10-12/README.md) corrects the equal-quality verdict defect and passes the same offline conclusion-safety gate. The original recording/study findings below remain historical evidence; they have not been rewritten or reclassified. Public deployment parity and video publication are still pending.

October 12, 2026. **The measured evidence improvement comes from deterministic code. This study establishes no incremental AI benefit.** It also finds an existing chance-quality conclusion error, so the publication-safety gate is not met.

PR #29 was reviewed and squash-merged at its exact head (`d6c3f82`) after both verification and both Cloudflare CI checks passed; 87 focused review tests also passed locally. This work starts from synchronized `origin/main` at `5b76572970bff58de74965ad130d8eb38285c0a9`. It changes evaluation code and documentation, not product behavior or inference settings.

## Reproduce

Use the repository's supported Node version and installed locked dependencies:

```sh
npm ci
AI_ENABLED=false npm run eval:director:offline
AI_ENABLED=false npm run check
```

The first command after installation runs 102 checks and writes:

- `artifacts/director-offline/results.json`: all outputs in both styles, facts, interpretations, citations, traces, case scores and timings.
- `artifacts/director-offline/transcripts.json`: complete mocked provider request/response bodies, including failed investigations.
- `artifacts/director-offline/summary.json`: compact results, frozen cases, independent references, environment and source hashes.

The committed [result snapshot](director-offline-results.json) is the compact output from an isolated local run on Node 24/macOS arm64. Two consecutive runs reproduced every non-timing field exactly, including input, source and transcript hashes and token estimates. Timing varies with startup and machine load. CI runs the same suite inside `npm test` and uploads all three artifacts.

The evaluation overwrites provider settings with test-only values. The tests install a throwing fetch guard before configuring dummy credentials, then replace fetch with a script that accepts only the dummy endpoint and never delegates to native fetch. Provider usage is deliberately absent; no paid request, real inference, deployment or public activation occurs. In-memory quotas are isolated with a test clock. Provider pacing is mocked, while each matrix workflow simulates the existing 30,000-token capacity ceiling using the production payload estimator. This is not a load or durable-accounting test; the existing reliability suites still run in the full check.

## Comparison design

| Arm                           | What runs                                                                                                         | What it isolates                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A: existing deterministic     | Current observer, complete hypothesis assessment, and all three original guided answers                           | Existing shot counts, recovery links, opponent activity, fading and chance quality |
| B: strengthened deterministic | A plus the new offline shot-route comparison                                                                      | Additional possession arithmetic and comparison predicates from PR #29             |
| C: fixed mock                 | Same production question/provider/verifier path; script requests aggregate, then first current shot sequence      | Fixed evidence retrieval and safe publication/fallback                             |
| D: adaptive mock              | Same path; script requests aggregate, illustrates the largest multi-shot possession when present, otherwise stops | A hand-written conditional retrieval policy and early stopping                     |

A is a **feature ablation on current code**, not an execution of a historical binary. The prior implementation ref is recorded for lineage; nothing calls A a frozen old-model result. Both scripts see the same full initial assessment and guided answers. Scripts read serialized tool responses only, have no fixture/gold access, and copy the interpretation registry already supplied by the production workflow. This deliberately exposes how much the deterministic code supplies. A successful script is not evidence that Foundry would choose, complete or prefer the same investigation.

There are **14 authored synthetic states in seven correlated families**, with eight eligible investigations and six no-call controls. All have a fixed 30-minute cutoff and paired 0–15 / 15–30 minute windows. The case manifest is hash-locked in a regression test; no failed case is dropped.

| Scenario            | Diagnostic distinction                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Misleading evidence | Six shots and four recovery links can mean two linked possessions, with three shots in one possession; matched spread has four linked possessions. A separate case has unchanged earlier route frequency. |
| Opponent activity   | Matched own-team evidence with opponent shots rising 1 → 5 versus remaining 1 → 1.                                                                                                                        |
| Fading momentum     | Same 2 → 6 headline increase with current halves 5 → 1 versus 3 → 3.                                                                                                                                      |
| Missing information | Separate missing possession, location and second-level timing controls; missing xG retains available route investigation while withholding chance-quality judgment.                                       |
| Quiet match         | A low-activity state and an empty stream offer no shot-surge question. This is focused-question abstention, not a claim that the whole Director must be silent.                                           |
| Settled control     | No qualifying recovery links: deterministic answer, zero requests.                                                                                                                                        |

These are development diagnostics, not held-out recorded matches. They do not fulfill the proposal's 24-state/four-recorded-match or blinded-review design. The related pairs are not independent samples, and no human preference scores or significance claims are supplied.

## Scoring

Reference numbers and expected citation sets are calculated from the authored event tuples, independently of production observers, recovery predicates and route calculators. Hand-labelled interpretation statuses are separate from both production and mock outputs. Hand checks pin the central 2 → 6 shots, four linked shots, two versus four linked possessions, 5 → 1 versus 3 → 3 halves, and missing-as-unknown results. Scorer mutation tests detect wrong numbers, wrong citations, false verdicts, missing caveats and irrelevant replay queries.

- **Investigation relevance:** fraction of attempted follow-ups that are an exact in-scope aggregate or a prelabelled diagnostic replay anchor. Requests made before a capacity fallback remain in the denominator. This is an authored query rubric, not a human relevance rating. No-call arms receive no percentage rather than automatic 100% credit.
- **Additional useful evidence:** fact–case pairs on a predeclared material-fact list, absent from A and present in the final evidence. This includes an explicit unknown when completeness itself qualifies a conclusion. Synonymous measurements are normalized; duplicate queries, prose length and replay illustrations do not count as discoveries. Retrieved facts are also reported separately from facts supplied by fallback.
- **Factual accuracy:** independently checked numeric/unknown assertions, original guided verdicts, and new interpretation statuses. Numeric equality tolerates floating-point noise; semantic verdicts must still be correct. Canonical identity, cutoff, exact per-fact citation sets and mandatory caveats are separate checks. This is not an unrestricted natural-language quality assessment.
- **Unsupported conclusions:** wrong original guided verdicts plus wrong new interpretation statuses in published answers. Injected invalid plans are tracked separately from output safety, and a safe fallback never counts as a successful model completion.

## Results

| Metric                                                   |       A |       B | C: fixed mock | D: adaptive mock |
| -------------------------------------------------------- | ------: | ------: | ------------: | ---------------: |
| States retained                                          |      14 |      14 |            14 |               14 |
| Verified scripted completions / eligible                 |     N/A |     N/A |           6/8 |              8/8 |
| Capacity fallbacks                                       |       0 |       0 |             2 |                0 |
| Relevant / attempted follow-up queries                   |     N/A |     N/A |         11/16 |            11/11 |
| Useful fact–case pairs covered / 35                      |       7 |      35 |            35 |               35 |
| Additional useful fact–case pairs over A                 |       0 |      28 |            28 |               28 |
| Additional useful fact–case pairs over B                 |       0 |       0 |             0 |                0 |
| Additional useful pairs actually retrieved through tools |       0 |       0 |            24 |               24 |
| Correct / scored assertions                              | 205/216 | 349/360 |       349/360 |          349/360 |
| Unsupported published conclusions                        |      11 |      11 |            11 |               11 |
| Invalid identities or incorrect citation sets            |       0 |       0 |             0 |                0 |
| Missing required caveats                                 |       0 |       0 |             0 |                0 |
| Mock HTTP dispatches                                     |       0 |       0 |            22 |               19 |

All six controls dispatch zero requests in both mocked arms. All **40 injected plans** (five attacks × eight eligible cases) are rejected, with the deterministic evidence preserved: invented reference, incorrect status, omitted challenge, causal/future prose, and unseen replay. These rejected plans are failures, not completions. A separate one-request no-added-insight test confirms an honest stop receives no discovery credit.

The 28 additional pairs are **24 route-arithmetic pairs across eight eligible states, plus four deterministic uncertainty/zero-link pairs in controls**. B already provides every one. Opponent changes, fading, missing xG and linked-shot totals were already supplied by A. New AI factual discovery over B is zero in this experiment. The adaptive script avoids five unhelpful replay queries and three dispatched requests compared with the fixed script; this is a property of the authored policy, not measured model intelligence.

### Existing factual defect: equal xG described as lower

All shots with available ratings are exactly 0.1 xG. With two earlier shots and six current shots, JavaScript summation/division produces a current mean slightly below 0.1. The existing `chance-quality` branch in `src/lib/ai/director/questions.ts` compares the unrounded means strictly and publishes “lower,” while the displayed means are both 0.1.

This occurs in all 11 question states with complete xG, in every arm. The route-comparison statuses themselves have zero mismatches. The larger arms score more correct assertions, so their overall ratio is 96.9% versus A's 94.9%; **that denominator change is not a factual-accuracy improvement**. All retain the same 11 incorrect conclusions. The evaluation tests pin and report this known defect instead of asserting a false clean score; a passing test run is not a passed publication-safety gate. Product behavior is left unchanged in this evaluation PR. A follow-up should use a defined numerical tolerance for the quality verdict and add an equal-quality regression test, then rerun this corpus.

### Latency and estimated token usage

| Metric                                  |     A |    B |       C |       D |
| --------------------------------------- | ----: | ---: | ------: | ------: |
| Local median latency (ms)               |  4.97 | 4.89 |    6.12 |    6.65 |
| Local nearest-rank p95 (ms)             | 15.93 | 6.87 |   18.71 |    8.43 |
| Estimated input tokens, total           |     0 |    0 | 174,433 | 147,464 |
| Estimated scripted output tokens, total |     0 |    0 |   3,998 |   4,079 |
| Full reservation tokens, total          |     0 |    0 | 214,033 | 181,664 |
| Actual model cost                       |    $0 |   $0 |      $0 |      $0 |

Latency is one local sample per state/arm (n=14), including fixture construction, evidence work, request serialization and verification, and including fallbacks. It excludes network, inference and pacing; p95 is the maximum with this sample size. Order/startup effects explain why a larger deterministic arm can appear faster. These measurements cannot satisfy or predict live latency gates.

Input estimate = `ceil(serialized request UTF-8 bytes / 3) + 256`; output estimate = `ceil(serialized scripted output bytes / 3)`. Reservations use the production estimator and include the full 1,800-output-token allowance on every request. Repeated conversation history is counted on each turn. These are sizing heuristics, not tokenizer counts, reported usage, or dollar projections. Raw estimates are retained per request in the transcripts.

C's third request would take `matched-separate-possessions` to **30,054** reserved tokens and `momentum-fades` to **30,194**, beyond the unchanged 30,000-token rolling-minute ceiling. The harness simulates capacity rejection before that dispatch; both outputs fall back and remain in all denominators. The aggregate has already been retrieved, so those retrieved-fact counts remain visible. Reported dispatch-token totals exclude the blocked request; `reservationAttempts` retains it. Real contention and inference time may impose further limits; scripts do not establish production reliability.

## Validation and decision

`AI_ENABLED=false npm run check` passed type generation/type checking, **666 unit tests** (six environment-dependent skips), and the production build. The new suite contributes 102 tests. Two isolated evaluation runs reproduced all non-timing results. Formatting and whitespace checks pass. The CI artifact step now retains complete outputs and transcripts.

Prefer the strengthened deterministic answer on the evidence available here. No actual AI improvement, live completion rate, human preference, live latency or live token spend is established. The publication-safety gate remains failed because of the inherited chance-quality verdict. The proposal's recorded-match, live and blinded-review gates remain unmet. No result authorizes paid inference or public activation.
