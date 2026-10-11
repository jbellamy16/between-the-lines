# Bounded Foundry evaluation — October 11, 2026

**Blocked before paid execution. Live acceptance criteria were not met.** The owner authorized this specific six-case / twelve-attempt / US$0.50 study. Existing application allowances cannot support it without changes the owner expressly prohibited. No provider request, Azure change, deployment, video publication or competition submission occurred. Human wording/usefulness review remains pending.

## Merge and frozen candidate

[PR #24](https://github.com/jbellamy16/second-look/pull/24) was reviewed at `00705665ab4d65107d018bc49d466dc6b5bdad17`. Its changes were documentation, JSON evidence and screenshots; no product code changed. No review comments, conflicts or concrete blocking defects were found. All four available checks passed. GitHub reported no required checks, branch protection or repository rulesets; no protection was bypassed. Following existing repository history, it was marked ready and merged with an exact-head guard as **`9b2cd5015391817d0eb0641637cc77c9e897fb7e`** at 16:27:04 UTC / 11:27:04 a.m. Chicago. Local main was fast-forwarded safely; the other worktree and existing branch were preserved.

The new branch is `codex/foundry-bounded-study`. The exact candidate evaluated **offline and at read-only preflight** is **`b4443e9eb809ab466b788b83221291f633834a66`**, Director **1.4.0**. No commit was evaluated against a live provider. Application source is unchanged from the PR #24 merge. The [manifest](manifest.json) freezes the candidate, all application and harness source hashes, prompt hash, fixture digests, neutral preferences, current `analyst` investigation mode, provider identity and runtime settings. Later documentation/receipt commits do not change which candidate was checked.

## Concrete execution blocker

The [preflight receipt](preflight.json), captured at **16:41:59 UTC / 11:41:59 a.m. Chicago**, establishes:

| Control                     | Existing state                                                                                                                 | Consequence                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Local application workflows | Minute / hour / day / total all **2**                                                                                          | Hour/day/total cannot support six workflows or twelve attempts.                                                |
| Local usage store           | Memory; **no configured shared Redis counter**                                                                                 | Remaining durable workflow/attempt allowance is unknown. A fresh process cannot be treated as replenishing it. |
| Hosted application          | AI disabled; minute/hour/day/total **0**                                                                                       | Hosted allowance supplies no alternative headroom.                                                             |
| Existing Foundry deployment | `between-the-lines-gpt54-mini`, GPT-5.4 Mini `2026-03-17`, GlobalStandard, West US 3, capacity **10**, **10 RPM / 10,000 TPM** | Model and allocation verified read-only, unchanged.                                                            |

The new dollar allowance does not override the instruction to preserve application quotas and counters. No historical allowance was reused. No key was fetched because the earlier controls gate already blocks inference. Process configuration and `.env.local` remain unchanged.

## Cases and evidence

All **six live campaign cases are not attempted** because the shared preflight failed: **0 live completions, 0 provider failures, 0 executed live-campaign abstentions**. The separate offline preparation checked all six fixtures and identified **one no-call preflight abstention**. It is not a provider success and does not consume a paid workflow. The raw [campaign results](results.json) preserve this distinction: all live rows are `not_attempted`; the manifest and offline receipt retain the eligibility decision.

| Case               | Cutoff | Checked offline evidence                                                                                                                                                                                                                           | Live outcome                                           |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| misleading-quality | 30:00  | Diagnostic fixture: four shots versus one, synthetic xG 0.2 versus 0.8. Both styles and Quick/Full preserve the lower-quality qualification.                                                                                                       | Not attempted                                          |
| pressure-fan       | 63:24  | **Analyst mode** despite the historical name. Harbor 1–0; four shots and four high ball wins versus zero across 45:00–54:12 / 54:12–63:24. No percentage from zero or causal pressing claim.                                                       | Not attempted                                          |
| temporal-weakening | 70:00  | Four shots versus one; latest half one after three. Separate five-minute recovery history falls from three to one. Weakening remains explicit.                                                                                                     | Not attempted                                          |
| temporal-resolved  | 75:00  | Recovery episode is resolved after zero recoveries. Hugo Silva's 74:35 equalizer makes the current lead a directly checked score change: **no AI investigation needed**. Tested with inference configured and scripted transport; zero dispatches. | Not attempted; separately checked preflight abstention |
| unfamiliar-8911    | 70:00  | Current balanced generator reproduces every saved event field. Harbor shots four versus two; score 1–1. Uses this seed's evidence.                                                                                                                 | Not attempted                                          |
| unfamiliar-73129   | 70:00  | Current balanced generator reproduces every saved event field. Harbor ball win at 62:41 precedes Jude Moreno's 63:05 shot in the same possession; score 2–0.                                                                                       | Not attempted                                          |

[Fixture checks](fixtures.json) contain independently filtered counts/windows and current observer candidates. [Offline preparation](offline-preparation.json) preserves the actual deterministic `directMatch` outputs, selected claims, source evidence, query/hypothesis verification and both locally rendered styles with Quick/Full. These selections are **application selections**, not claimed Foundry choices. The six scripted-runtime tests separately exercise the current provider path and cache, using mocked HTTP only.

## Spending and durable guard

| Measure                                                               | Recorded value                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Live workflows / actual provider HTTP attempts                        | **0 / 0**                                                            |
| Live tool invocations / retries / provider latency                    | **0 / 0 / unavailable**                                              |
| Provider-reported input / cached / output usage                       | **No usage reports**; no requests were sent                          |
| Reported-token estimate / reservations / conservative accounted spend | **US$0 / US$0 / US$0**                                               |
| Authorized study ceiling                                              | **US$0.50**; unused, not automatically carried into another campaign |
| Human preference / usefulness result                                  | **Unavailable**; review fields remain empty                          |

The [Microsoft retail API](https://prices.azure.com/api/retail/prices) returned the exact West US 3 Global Standard meters: **$0.75/M input, $0.075/M cached input, $4.50/M output**, effective March 1, 2026 and checked at preflight. Meter IDs, query and values are retained in the receipt. Microsoft's [model specification](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-54) documents the context/input limits. The harness reserves **400,000 uncached input tokens plus all 1,800 output tokens = $0.308100 per dispatch**, deliberately above the documented 272,000 input maximum. It does not use the request-size heuristic as a dollar ceiling.

The [study ledger](ledger.jsonl) contains initialization and the preflight stop only. The tested implementation fsyncs every reservation before dispatch, limits attempts/workflows, retains unknown usage, validates reported counts and stops before crossing fifty cents. Known usage is accounted at uncached input rates; a separate estimate recognizes reported cached tokens. A full unknown reservation would prevent a second maximum reservation under this cap, even when the runtime would otherwise allow a 429 retry. These are conservative token-price accounting rules, not a billing invoice or a cap on unrelated subscription costs. See the [harness method](../../../eval/foundry-study/README.md).

## Validation and preservation

- **24 targeted harness tests passed**: six current-runtime fixture cases, fresh evidence verification, local renderings/cache reuse, retry guidance, terminal 429, failures, cancellation before/in flight, ignored cancellation detection, timeout, missing/invalid usage, corrupt/mismatched journals and every study ceiling. All HTTP is scripted. Tests use isolated temporary journals and test-only application counters.
- Fresh **typecheck, 487 unit passes / three conditional skips, production build** passed. Skips require external Redis or an optional local StatsBomb fixture. Existing Redis integration coverage remains in CI; this run did not create a Redis service.
- Focused production-browser explanation/recap checks: **12 passed / two hidden recorded-source skips**. They cover style/length changes, reuse on reopen, in-flight behavior and rewind. Chromium is not physical Safari or human review.
- Read-only preflight and offline receipt generation passed. A green harness command means receipts were produced, **not** that live criteria passed.
- No application or prompt defect was established. During harness development, a source-identity assertion was corrected to respect the existing distinction between canonical event IDs and generator source IDs for unfamiliar seeds; no product behavior or fixture was changed.
- Historical receipts, source fixtures and prior ledgers remain unchanged. Existing generated local artifacts were backed up before broad tests and restored afterward; new outputs live only in this dated study directory. [Validation receipt](validation.json) records preservation and checks; [receipt hashes](receipt-hashes.json) cover the final evidence files.

## Next steps

1. Review this draft PR, including the spending guard and the explicit blocked outcome. Keep it unmerged until reviewed. Human wording review remains a separate pending activity; no response has been invented.
2. Establish access to an **existing durable application allowance with sufficient remaining headroom**, or separately authorize the necessary control changes. Raising local limits, resetting counters or provisioning a store is outside the present authorization. A subsequent reviewed execution must retain these receipts and refresh deployment, prices and allowance checks; do not delete this ledger to restart.
3. Complete the current Plain English / Football Analysis participant protocol. Even six future successful calls would not establish production reliability or viewer preference.
4. After separately approved deployment, verify the exact released commit and signed-out judge access. Record the prepared under-two-minute offline demo with real narration, proofread captions and verify duration. Publication and competition submission still require owner action. The pending live study must not be represented as successful in the recording.
