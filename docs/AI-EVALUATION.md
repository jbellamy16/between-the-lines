# AI evaluation and release gate

## Current submission status — October 11, 2026

PR #23 merged as `fb108863dae6a69a7af0df0101ca1fbc66ab4be1`. Current Director `1.4.0` includes PR #22's compact application-first retrieval and shared request accounting; PR #23 adds local Plain English / Football Analysis. These changes have automated offline and scripted-provider validation, **not a new live evaluation**. Earlier successful calls below do not validate this release. The latest historical live study is [Director 1.2.0 at 22fb005](intelligence/pr18-intelligence-2026-10-10/REPORT.md), evaluated October 10 America/Chicago: 14 publications, four provider failures and one no-call abstention. Human review is pending.

PR #24 merged as `9b2cd5015391817d0eb0641637cc77c9e897fb7e`. The owner subsequently authorized the six-case study, but [current preflight](intelligence/foundry-bounded-2026-10-11/REPORT.md) blocked paid execution: local limits are two with no durable shared allowance, and hosted quotas are zero. Candidate `b4443e9eb809ab466b788b83221291f633834a66` has a tested durable harness and offline evidence; **zero provider attempts and US$0 spending**. Live acceptance criteria remain unmet. The original [proposal](intelligence/foundry-efficiency-2026-10-11/REPORT.md#current-submission-evaluation-addendum), [submission validation](submission-preparation/VALIDATION.md), and historical receipts retain their original scope and dates.

## Historical editorial and model comparison

The owner-authorized [three-arm editorial/model comparison](EDITORIAL-MODEL-COMPARISON.md) completed 36 workflow attempts for an estimated $0.95456210. It retains four rejected plans and the subsequent fixes. Final paired difficult-case checks passed on both Mini and GPT-5.4; keep Mini configured based on the observed usefulness/cost tradeoff. The complete final live matrix and human semantic sign-off remain pending. Public inference stays disabled.

## AI Intelligence 2.0

The new Match Director has a separate [architecture, safety contract, 200-case evaluation and live-review protocol](intelligence/README.md). The Foundry director and recap workflows were exercised with real requests on October 10, 2026; see the [Foundry evaluation report](FOUNDRY-EVALUATION.md) for measured costs, failures, fixes and coverage. Public inference remains disabled. Human semantic review and evidence of editorial improvement remain pending. The older OpenAI results below belong to the preceding workflow.

## Earlier OpenAI evaluation (October 9)

Two owner-authorized OpenAI evaluations on October 9, 2026 completed **eight real HTTP 200 Responses requests** in total. No Foundry calls occurred in those October 9 runs. Subsequent Azure deployment and Foundry testing are documented separately; normal public inference remains disabled.

| Run                | Requests | Fan result                           | Analyst result                         | Input / output tokens | Estimated cost |
| ------------------ | -------- | ------------------------------------ | -------------------------------------- | --------------------- | -------------- |
| Initial            | 4        | Fallback, 5.37s                      | Fallback, 4.13s                        | 6,117 / 586           | $0.00722475    |
| Diagnostic recheck | 4        | **Accepted OpenAI narration**, 3.50s | Fallback: omitted required goal, 3.65s | 6,117 / 463           | $0.00667125    |
| Total              | **8**    |                                      |                                        | **12,234 / 1,049**    | **$0.013896**  |

These estimates use returned token usage and standard GPT-5.4 Mini rates; actual billing was not inspected. The initial report did not retain the cause of rejection. The diagnostic recheck retained public fact selections and showed that the Analyst selected valid comparisons but omitted the early goal. It did not invent a statistic.

The server now supplies required score, latest goal, selected insight and abstention context, leaving AI to choose additional observations within the four-fact limit. Unknown IDs, duplicates and arbitrary prose still fail validation. A sanitized capture in `eval/fixtures/openai-2026-10-09.json` replays both real selections successfully under this contract, including a rewind rejection. **This was offline regression evidence at the time; both revised recap modes subsequently passed the October 10 Foundry evaluation.** All eight authorized requests are consumed; any further live run needs a new allowance.

Assistant review of the accepted Fan recap found its 1–0 score, Arlo Hayes goal at 01:00, four high ball wins versus zero, and four shots versus zero consistent with the recorded pressure fixture at 63:24. The selection is useful context but remains templated; this small sample does not demonstrate improved editorial quality over the deterministic baseline. Human semantic review remains pending. Mocked token counts and timings are separate from these real observations.

The default repeatable suite covers 180 combinations: pressure/substitution/quiet × seeds 202632/43/71 × timestamps 0/1800/3300/3804/5400 × Fan/Analyst × OpenAI/Foundry. It compares score, evidence counts, timestamps, mandatory context and rendered claims with regenerated event data. Additional tests reject forged evidence/statistics, unknown facts, duplicate facts, arbitrary free-form prose, wrong tools, incomplete responses, refusal and HTTP failures. Tests also ensure server-supplied score/abstention/goal context cannot be omitted. Ordinary tests never require a provider key.

```sh
npm run check
npm run eval:ai
npm run test:e2e
```

Report: `artifacts/ai-evaluation.json`. CI uploads it separately. A real Redis integration test runs in CI; locally it runs when `REDIS_TEST_URL` points at a disposable test Redis instance. It uses isolated random keys and cleans up those keys only. It checks concurrent workers, persistent total counts, lock ownership, cached responses, and failure cooldown. Other tests check production fail-closed behavior and local fallback controls.

## What automation proves, and what it does not

| Dimension            | Repeatable check                                                                    | Remaining judgment                                                      |
| -------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Factual accuracy     | Every displayed claim is rendered from server-verified facts                        | Review wording for misleading implications and omissions                |
| Unsupported claims   | Only enumerated IDs accepted; no model prose enters UI                              | Review whether the supplied templates themselves overstate evidence     |
| Evidence consistency | Counts, IDs, teams, windows and visible prefixes compared                           | Football relevance of each observation                                  |
| Narrative quality    | Bounded output and required context                                                 | Readability, repetition, coherence and usefulness, scored 1–5           |
| Fan / Analyst        | Accessible versus measurement-focused wording; distinct outputs when patterns exist | Does each audience learn something useful?                              |
| Relevance            | Editorial ranking factors and required decisive context                             | Blind comparison against deterministic recap; don't assume AI is better |
| Latency              | End-to-end and provider timings recorded                                            | Live p50/p95 only after a larger authorized sample                      |
| Cost                 | Returned token usage, cache reuse and standard-rate estimate                        | Provider billing, failures without usage, regional and negotiated rates |
| Fallback             | Disabled, missing store, limits, malformed output and provider failure              | Usability when inference is slow or repeatedly unavailable              |

Mock outputs follow the deterministic baseline on purpose. A perfect result means contract correctness, not an impressive model. The AI chooses verified sentences rather than writing unconstrained prose. That design prevents unsupported generated sentences, but cannot guarantee a good editorial choice or that every source template is semantically perfect.

## Semantic review before enabling public AI

A human reviewer must compare the real output, deterministic baseline and event evidence. Automated assertions and an assistant's code review do **not** satisfy this gate. Leave the gate pending until someone records their review.

Use at least these cases:

- Pressure at 63:24: Harbor high ball wins and shots are each 4 versus 0 in equal preceding windows. Two of the high wins are followed by a shot within the same recorded possession. Do not turn this association into proof of a pressing system or causation. No percentage increase from zero.
- Substitution just before and after 55 minutes: the actual substitution may occur later at a possession boundary. Before the recorded event, do not mention the change; afterward, do not claim it caused improved performance.
- Quiet opening and quiet demo timestamp: abstain from announcing a tactical shift without qualifying evidence. A score or individual chance may still be reportable.
- Rewind: compare identical timestamps in the full event array and truncated prefix. No later goal, player change, or shot may influence the story.
- Full time: no prediction of further play; suggest revisiting a recorded moment.
- Preferences and repetition: follow a player/team, revisit a previously inspected pattern, and disable categories. Check whether personalization improves relevance without hiding score context.

For each output record factual errors, misleading implications, omitted decisive events, narrative quality (1–5), audience fit (1–5), relevance (1–5), and preference versus the deterministic baseline (AI/tie/baseline). Note the reviewer and date. Any factual error blocks public enablement. Require no unsupported claims and a clear usefulness benefit before expanding AI scope; otherwise keep deterministic selection and improve the candidates/prompt.

Current human sign-off: **pending**. Current live editorial benefit: **unmeasured**.

## Small authorized live check

Only after the owner explicitly authorizes spending:

1. Configure ignored `.env.local` with `AI_ENABLED=false`, `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL=gpt-5.4-mini`. For isolated local testing, set `AI_USAGE_STORE=memory`; for production, an existing TLS Redis store is mandatory. Set conservative quotas. Do not create a service as part of this procedure without separate approval.
2. Run `npm run ai:check` first; it reports configuration presence only, never prints keys or calls the API. After approval, run `AI_ENABLED=true SECOND_LOOK_AUTHORIZE_LIVE=yes npm run eval:live`. The enablement override applies only to this test process; normal app inference stays disabled. The runner explicitly loads AI settings from `.env.local` even under Vitest, preserves shell overrides, and never accepts authorization from the file. It runs two pressure recaps, Fan and Analyst, for **at most four new Responses requests**, subject to cache and usage limits. A test-transport guard enforces the four-request ceiling; each invocation needs its own owner-approved allowance. This command is deliberately separate from CI.
3. Inspect `artifacts/ai-live-evaluation.json`, including provider, cache flag, usage completeness, timing, evidence, and empty human-review fields. A cached result is not a new live test. An offline result fails the live test; provider errors may have incurred unknown billable usage.
4. Review against the deterministic baseline and submit a human sign-off. Expand to the remaining scenarios only with an agreed additional request budget.
5. Keep `AI_ENABLED=false` in `.env.local` after local testing. Foundry uses the same steps with its endpoint/key/deployment and `AI_PROVIDER=foundry` when access returns.

The cost helper estimates standard GPT-5.4 Mini token charges at $0.75/M input, $0.075/M cached input and $4.50/M output, verified in the [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini) on October 9, 2026. Unknown models, missing usage, and Foundry return unknown cost; the helper never assumes they are free. Compare estimates to actual billing. Alerts are not spending caps.

## Operator prerequisites

Before public inference, verify the existing host's TLS Redis connection, consistent settings across workers, persistence/no-eviction, short command timeouts, global limits and failure behavior. The persistent total reservation count is intentionally not automatically reset. Document every increase in allowance. Deployment stays manual. Per-user authentication/allocation remains a consideration for an expanded audience; the global limits protect the shared demo allowance but cannot ensure fair access among anonymous visitors.
