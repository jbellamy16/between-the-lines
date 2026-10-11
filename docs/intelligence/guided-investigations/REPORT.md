# Guided investigations — delivery and live evaluation

The feature answers three explicit viewer questions with canonical measurements, source qualifications and replay links while retaining the source story. The bounded Foundry campaign completed technically, but **did not demonstrate additional investigative benefit over the deterministic answers**.

## Candidate and results

Evaluated commit: **b56090090cf85c43a28ca07755764082d7bcaec3**, built from main **c8f895f** including PR #25. Question workflow **guided-1.0.0**, with existing Director **1.4.1**, provider deployment `between-the-lines-gpt54-mini`, model `gpt-5.4-mini` version `2026-03-17`, GlobalStandard, westus3.

**Five completed model answers, one correct no-call, zero failures, zero unattempted cases.** Five actual provider HTTP attempts; no retries. All original results passed fresh canonical reconstruction, independent event arithmetic, reference/cutoff checks, window checks and both style renderings. All five model plans chose the correct typed verdict. No provider-selected follow-up tools or supplemental facts were used: each paid workflow used one initial application retrieval and one provider call. Offline scripted tests separately exercise an optional counter-evidence follow-up and reject wrong intents, wrong conclusions, invented supplements and future prose.

| Predeclared case            | Actual answer and decisive evidence                                                                                                                       | Same-question deterministic comparison — assistant analysis                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| unavailable-quality · 63:24 | Cannot compare mean quality: earlier 0 shots, current 4. Current xG/shot 0.145; earlier mean unknown. Zero HTTP attempts.                                 | Correct no-call. Identical deterministic limitation; no model benefit claimed.                                         |
| misleading-quality · 30:00  | No. Shots rise 1 → 4, but total xG falls 0.8 → 0.2 and per-shot xG falls 0.8 → 0.05.                                                                      | Confirmed the baseline. No added evidence or improved conclusion.                                                      |
| opponent-response · 30:00   | Yes. Riverside 0 → 5 shots; Harbor 1 → 4 in the same 15-minute windows. Missing source xG and the lack of evidence for one-sided control remain explicit. | Confirmed the baseline. No added evidence or improved conclusion.                                                      |
| fading-increase · 70:00     | Yes, recent activity eased: wider count 1 → 4, but current-window halves 3 → 1. Wider windows last 12m30s; nested halves last 6m15s.                      | Confirmed the baseline. No added evidence or improved conclusion.                                                      |
| unfamiliar-opponent · 70:00 | Riverside stays 1 → 1 while Harbor rises 2 → 4 in corresponding windows.                                                                                  | Confirmed the baseline on balanced seed 8911. No added evidence or improved conclusion.                                |
| unfamiliar-quality · 70:00  | Higher source rating per shot: 0.115 → 0.165; total xG 0.23 → 0.66 and shots 2 → 4.                                                                       | Confirmed the baseline on the same unfamiliar source with a distinct intent. No added evidence or improved conclusion. |

These assessments are **assistant analysis**, not human preference or viewer feedback. More calls or alternate wording would not itself demonstrate improvement. This campaign used synthetic/diagnostic evidence, including a previously unfamiliar seed, not a live real-world football feed. The product supports source-constrained canonical recorded matches, but this paid campaign does not establish model performance on them. The selected sample is small and not a statistical reliability estimate.

## Spending and safeguards

- **US$0.01632525** conservatively accounted against **$0.50**. Reported-rate estimate is also $0.01632525; zero cached input tokens were reported. This is token-rate accounting, not a billing invoice.
- **20,981 input / 131 output tokens**, five HTTP 200 completed responses, zero unknown-usage reservations. Paid workflow elapsed times range **1,294–1,971 ms**. The whole campaign took about 339 seconds, including mandatory 65-second spacing and preflight.
- Each dispatch reserved **$0.308100** before HTTP: 400,000 input tokens at $0.75/M, plus 1,800 output tokens at $4.50/M. Five sequential reservations total $1.5405 gross; this is not spending or simultaneous exposure. Each settled before the next reservation, with actual charges retained. The guard always required existing charges plus the next full reservation to stay below $0.50.
- Current prices and deployment identity were refreshed read-only. Existing capacity stayed **30 RPM / 30,000 TPM**. Process workflow limits were **2/minute and 12/hour/day/total**, alongside the independent six-workflow/twelve-attempt ledger and unchanged per-workflow safeguards.
- New dedicated free local store only. Zero counters and then charged totals **5 workflows / 5 attempts** survived real restarts. The ledger counts six cases because the no-call case does not consume the application's inference allowance. The single-use execution claim remains. The campaign container is stopped; its volume, counters and receipts are retained.
- Historical receipt hashes are unchanged. Historical study runners were not restarted. Persistent `.env.local`, original-checkout `next-env.d.ts`, Azure capacity and hosted settings were not changed. Hosted AI remains false with zero quotas. No deployment, merge, outreach or publication occurred.

## Later offline fix

After the campaign, a new browser regression reproduced a UI race: an older generic Director investigation could complete after a guided question was chosen and replace its source story. The original paid receipts are untouched; see [the failing regression record](post-campaign-regression.json).

The final implementation cancels that older generic subscriber on question selection, preserving the story, answer and replay context. This UI fix was validated offline and **was not paid-evaluated**. It does not change question prompts, retrieval, canonical evidence, verification, pricing or the frozen campaign cases. No second campaign was run. The evaluated commit and later delivery commits are deliberately distinct.

## Validation and readiness

Before paid execution: type checking and production build passed; **529 tests passed, one optional test skipped**, including real Redis accounting and restart/corruption/exhaustion tests. The full local browser suite passed **231 tests** across desktop and two touch viewport sizes. The final pre-campaign targeted rerun passed **15 tests**. Desktop, tablet and mobile screenshots were visually inspected; the question panel passed keyboard, contrast and overflow checks. The evaluated commit passed both GitHub [verify](https://github.com/jbellamy16/second-look/actions/runs/38164556610/job/114544296507) and [Cloudflare](https://github.com/jbellamy16/second-look/actions/runs/38164556610/job/114544296729) jobs.

Post-fix validation passed all **63 relevant browser tests**, including the new regression at all three viewport sizes. Type checking, **529 unit tests** (one optional skip), and the production build were repeated successfully. Final-head CI is recorded in the PR. The optional skip is the local complete StatsBomb research-fixture check, which requires an opt-in flag and an untracked local source file; it makes no external AI calls.

**Recommendation:** ready for review and supervised viewer testing of the guided deterministic experience after final CI. Keep public AI disabled: this campaign establishes constrained answer reliability at the new allocation, but does not establish useful model contribution or a live multi-turn investigation. Human relevance testing and broader recorded-match validation remain necessary before enabling paid viewer investigations. No deployment is requested by this report.

## Walkthrough, screenshots and original receipts

- [Reproducible product walkthrough and evidence contract](README.md)
- [Desktop](desktop.png) · [Tablet](tablet.png) · [Mobile](mobile.png) · [Android-sized view](android.png). These screenshots show deterministic product behavior, not invented live AI success.
- [Frozen manifest](../guided-foundry-2026-10-11/manifest.json), [original results and case-by-case comparisons](../guided-foundry-2026-10-11/results.json), [same-question baselines](../guided-foundry-2026-10-11/baselines.json), [append-only ledger](../guided-foundry-2026-10-11/ledger.jsonl), [receipt hashes](../guided-foundry-2026-10-11/receipt-hashes.json).
- [Charged store after restart](store-after-campaign-restart.json). Never reset this allowance or rerun the single-use launcher.
