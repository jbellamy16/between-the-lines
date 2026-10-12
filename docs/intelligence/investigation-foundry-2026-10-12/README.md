# Investigation evaluation: offline preflight and proposed Foundry pilot

Prepared October 12, 2026, after reviewing and merging [PR #30](https://github.com/jbellamy16/second-look/pull/30) at `1f94aca6a4916543d2372bf402800deed65ab3fc`. The reviewed head was `ddb847551273261e4b530b0199f57fd1d11768dd`; its four CI checks and 102 focused offline tests passed before merging. This preparation branch starts at the resulting `origin/main`.

**Decision: keep the strengthened deterministic answer. No meaningful additional value from actual model-selected investigations is established.** This task made zero inference requests and spent $0. The offline preflight passes preparation/integrity checks, but live execution is blocked, and the inherited publication-safety gate remains failed. No historical authorization extends to this pilot.

## Reproduce without inference

```sh
npm run eval:investigation:prepare
```

The command has no live mode and rejects arguments, including `--live`. It does not load environment files, fetch credentials, contact Azure or Redis, or change settings/counters. It removes provider configuration from the test child, runs the prior task's 102 offline tests plus the new preflight tests, and validates the complete four-arm, 14-state matrix. The previous harness's dummy endpoint and throwing transport guards prevent real inference. The preparation process itself also refuses fetch.

Each run creates an exclusive timestamped directory under `artifacts/investigation-preflight/`, with the complete new results, transcripts, source hashes, artifact hashes, and a preservation manifest. Before and after testing, the command compares 191 historical evaluation, receipt, test, and runtime files byte-for-byte with the merged PR #30 tree. It refuses drift. The command is deliberately tied to this candidate; a future product fix requires a reviewed new preparation. The legacy harness still regenerates its scratch `artifacts/director-offline/` outputs; committed historical records are untouched.

The [saved preflight](preflight.json) and [preservation manifest](preservation.json) are a snapshot of this run. Fresh repetitions remain in their own artifact directories. The [read-only readiness snapshot](read-only-readiness.json) was collected separately at 14:42:53 UTC (09:42:53 Chicago) using the existing guided-study preflight collector. Its original six-workflow blocker text belongs to that collector; the new preflight recomputes allowance blockers for the narrower pilot below. The offline command consumes this dated snapshot and never claims to refresh cloud state.

## Proposed budget: no authorization granted

| Bound                                                     |                                             Proposed maximum |
| --------------------------------------------------------- | -----------------------------------------------------------: |
| Inference spend                                           |                                                **$0.50 USD** |
| Eligible model investigations                             |                                                        **1** |
| HTTP attempts, including retries and failed/unknown calls |                             **2 total; 2 per investigation** |
| Request output allowance                                  |                                        Existing 1,800 tokens |
| Serialized request size                                   |                                       Existing 131,072 bytes |
| Request/token minute ceilings                             | Existing 30 RPM / 30,000 TPM, or any lower configured limits |
| Workflow deadline                                         |                                          Existing 55 seconds |
| Concurrent workflows / automatic continuations            |                                                        1 / 0 |

The confirmed deployment remains `between-the-lines-gpt54-mini`, `gpt-5.4-mini` version `2026-03-17`, Global Standard, West US 3, capacity 30. No deployment, model, prompt, reasoning, output, throughput, or retry setting was changed. The proposed study caps are additional restrictions, not replacements for application controls.

Current local workflow limits are **2/minute, 2/hour, 2/day, 2 total**; attempt allowances also use the hour/day/total values. The configured store is memory, so remaining durable allowance is unknown. Hosted inference remains disabled with zero workflow quotas. The initial six-investigation idea was narrowed to one investigation/two attempts to avoid proposing a quota increase. Even this smaller pilot cannot currently launch. Do not initialize a store, reset counters, revive historical execution claims, repurpose old study allowances, or raise settings to make it fit.

Retail prices were verified by the read-only collector: $0.75/M uncached input, $0.075/M cached input, and $4.50/M output. The existing conservative envelope reserves **$0.308100 per dispatch**, using all 400,000 context tokens as uncached input plus the complete 1,800 output-token cap. The [Microsoft specification](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-54) gives a smaller 272,000 input maximum; this intentionally over-reserves. Current meter identifiers and the exact [Microsoft retail-price query](https://prices.azure.com/api/retail/prices?%24filter=armRegionName+eq+%27westus3%27+and+productName+eq+%27Azure+OpenAI+GPT5%27+and+%28skuName+eq+%275.4+mini+Inp+Gl%27+or+skuName+eq+%275.4+mini+cd+Inp+Gl%27+or+skuName+eq+%275.4+mini+Opt+Gl%27%29&currencyCode=USD) are retained in the readiness snapshot. Revalidate prices before any authorized dispatch.

The future single-use execution adapter must durably reserve in integer nanodollars before each dispatch and retain the full reservation on missing/invalid usage, timeout, cancellation, or ambiguous transport. The next reservation is allowed only when conservative settled charges plus all outstanding reserves plus $0.308100 are at most $0.50. An unknown first call leaves only $0.191900, so a second call is refused. Known usage settles all input at the uncached rate. Cached discounts are reported separately, never relied on for the ceiling. Taxes, hosting, and unrelated activity are outside this inference-only proposal. Token-size heuristics are sizing illustrations, not a billing bound.

No adapter is wired to native inference in this PR. The preparation's budget function tests arithmetic only; it is not a runtime spending control. Before a separately authorized run, review a single-use adapter with a durable journal and execution claim, verify existing durable allowance without resetting it, refresh deployment/prices, and bind the approved source/fixture hashes. All historical receipts and ownership claims must remain intact. If any requirement cannot be satisfied within existing controls, stop. Authorization to spend does not authorize changing those controls.

## Frozen comparison and bounded pilot

Reuse [the PR #30 framework](../DIRECTOR-OFFLINE-EVALUATION.md) unchanged: A is the original deterministic feature set on current code; B adds deterministic route comparison; C and D use fixed/adaptive scripts through the production question/provider/verifier path. All 14 authored synthetic states, seven correlated families, eight eligible cases, six no-call controls, and 40 injected invalid plans are retained offline. The independent tuple oracle, exact citation checks, conclusion checks, and original relevance/useful-fact rubric remain unchanged.

Only **`matched-separate-possessions`** is proposed for paid inference, once, using production `answerQuestion` with the same 30-minute cutoff, evidence, tools, prompt, and model settings. It distinguishes four linked possessions from the misleading shot-cluster case while testing whether the model stops after sufficient aggregates. It was selected explicitly for the two-attempt allowance: the adaptive script completes after aggregate retrieval plus final selection. This is a disclosed feasibility selection, not a representative or held-out sample. Other eligible states are _not scheduled_, never recorded as successful model abstentions. The six production no-call controls must be checked with a refusing transport before starting the paid case.

If the model chooses an optional replay and requires a third request, the independent two-attempt guard must refuse it and retain the fallback/failure in the denominator. No case substitution, repair, additional repetition, alternative model, paid judge, or automatic continuation is allowed. Retries consume the same two slots. Any capacity/accounting/provider failure, unsafe output, unexpected dispatch for a control, or spend ceiling stops the run. A user cancellation must abort in-flight work and retain uncertain charges. The current workflow can legitimately require three attempts; this pilot does not guarantee completion.

For the selected case, the adaptive script estimates 15,464 input tokens and 465 scripted output tokens over two requests (19,064 reservation tokens including full output allowances). Applying uncached retail rates gives an illustrative **$0.0136905**. The fixed script also dispatches twice but falls back when its third request would exceed the rolling 30,000-token limit; its $0.0126 illustration is a failed path, not a cheaper successful result. Neither number predicts real model usage or relaxes the $0.50 bound. Scripts omit provider usage, and the model may spend output tokens differently.

## Offline results and attribution

| Metric, full 14-state matrix               |       A |       B | C: fixed script | D: adaptive script |
| ------------------------------------------ | ------: | ------: | --------------: | -----------------: |
| Useful fact–case pairs / 35                |       7 |      35 |              35 |                 35 |
| Additional pairs over B                    |       0 |       0 |               0 |                  0 |
| Correct / scored assertions                | 205/216 | 349/360 |         349/360 |            349/360 |
| Unsupported published conclusions          |      11 |      11 |              11 |                 11 |
| Verified scripted completions / 8 eligible |     N/A |     N/A |             6/8 |                8/8 |
| Relevant / attempted follow-up queries     |     N/A |     N/A |           11/16 |              11/11 |
| Scripted HTTP dispatches                   |       0 |       0 |              22 |                 19 |

All six controls make zero requests; all 40 invalid plans are rejected. Two fixed-script capacity failures remain visible. The 28 fact–case gains over A come entirely from deterministic code. B already covers every predeclared useful fact, so this corpus has no remaining factual-discovery headroom under the fixed rubric. The higher assertion ratio does not fix an error: all arms retain the same 11 equal-xG-as-lower verdicts. The publication-safety gate remains failed; this preparation intentionally leaves product behavior and historical results unchanged.

Local execution times are saved per row, including failures. They exclude inference, network latency and real pacing, and are not live latency estimates. Real provider usage, live latency, model-selected results, and human preference remain null/unmeasured. Historical Foundry receipts from older prompts/workflows do not fill those fields for this investigation.

## Predeclared interpretation of a later authorized result

Score the real result with the same `factsFor`/`score` functions and compare it with both A and B on the identical event prefix. Save the original result before scoring, all attempted typed queries (including rejected/failing ones), disposition, request count, usage/status receipts, and local wall-clock duration. Do not save credentials, raw provider errors, or private reasoning. Reconcile every HTTP attempt with the durable money journal; cached results and deterministic fallbacks receive no fresh-model completion/discovery credit. Report failures and unscheduled cases explicitly.

- **Additional factual value:** count correct predeclared useful facts absent from B. Zero means no additional factual value, even if the request succeeds or wording/order changes. This corpus is already saturated by B; do not change the rubric after seeing the model output.
- **Investigation selection:** report relevant/attempted queries under the existing authored rubric, plus unnecessary follow-ups, abstention, verified completion, latency and actual token-rate estimates. These are selection/efficiency observations, not new facts or proof of intelligence.
- **Accuracy and safety:** report all unsupported conclusions, including inherited ones, and the delta against B. Reject new wrong facts, invented/future citations, omitted qualifications and unsupported statuses. The existing safety defect prevents an overall safety pass even if the model introduces no new error.
- **Emphasis/replay usefulness:** treat this as a separate, unmeasured human-utility question. A useful illustration is not a new fact. Do not infer user preference from verifier success or spend a model call to judge itself.
- **Decision:** a one-case diagnostic can show feasibility or a failure, not meaningful general benefit, reliability, p95 latency, recorded-match generalization, or a release recommendation. No incremental factual benefit plus extra latency/cost supports retaining B. Claims of broader usefulness require a separately designed and authorized study with held-out cases and blinded human review.

Recommendation: do not spend yet. Preserve this proposal, resolve the documented publication-safety defect in a separate reviewed change, and establish whether an existing durable allowance is available without changing limits. Any new candidate needs a new preflight. Explicit owner authorization remains required for every proposed paid campaign.

## Validation

The preparation run passed 111 focused tests (102 prior framework tests plus nine new checks). New tests reject incomplete/duplicate/mislabeled matrices, no-call dispatches, corpus drift and paid-output relabeling; exercise exact monetary boundaries and unknown reservations; keep missing durable allowance blocked; and reject a live command argument. `AI_ENABLED=false npm run check` passed type checking, 675 unit tests (six environment-dependent skips), and the production build. No browser behavior changes are included.
