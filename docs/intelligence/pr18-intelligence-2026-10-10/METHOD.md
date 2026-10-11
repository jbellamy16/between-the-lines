# PR #18 live intelligence evaluation — method and reproduction

Study date: October 10, 2026, America/Chicago. Machine receipts use UTC and may say October 11. Human review is pending. No reviewer response is implied by assistant ratings.

## Frozen implementation and evidence classes

The evaluated implementation is PR #18 at `22fb00517a38a8abadf00ae19d299a74f01d1fa0`, Director `1.2.0`. PR #18 was open at preflight; `origin/main` was `f7b0b87986efba09ca95bdf8750a39df31f1258f`. The starting working tree was clean. This study is on a separate branch; it neither merges nor deploys the application. Every AI, match and source file is checked against the evaluated commit before a run. No production prompt, generator, model, verifier or spending setting is changed.

Four evidence classes must remain distinct:

1. **Frozen deterministic:** `../original-baseline.json` contains 18 input-hashed states, original legacy outputs and Director 1.1.2 _candidates_. It does not contain original Foundry answers. All 18 paired states are checked in the offline suite; the live matrix also overlaps `pressure-4200-fan` exactly.
2. **Previously recorded real model:** preserved October 10 receipts include Director 1.0.2 at six matching synthetic states and Director 1.1.2 at unfamiliar seed 8911. Older versions are explicitly identified. Historical comparisons are sequential and not controlled concurrent A/B experiments. The older harness did not save a complete input digest: state identity is reconstructed from its case declarations and checked against the saved evidence IDs, cutoff and audience. Do not claim equivalent provenance to the new input-hashed run.
3. **New live Foundry:** this study's actual Responses HTTP attempts, returned tools, editorial plans, rejected/failed outcomes, verification and published results. HTTP 200 alone is not an accepted investigation.
4. **Scripted/offline:** ordinary regression tests, deterministic fallbacks and challenge fixture construction. None count as paid model successes or human preferences.

System A is the original deterministic detector, whose relevant source files are byte-equal to the frozen reference. For states outside the frozen JSON, its unchanged code is evaluated on the same input. System B is available as frozen 1.1.2 candidates everywhere covered by the old fixture, but as an actual 1.1.2 model result at only one matching new synthetic state. Earlier 1.0.2 model results form a separately labelled exploratory comparison. Missing historical responses are unavailable, never simulated.

## Test design

Eighteen predeclared states cover shot growth; declining synthetic xG despite more shots; opposing shot activity; a fading burst; favorite/inactive players; routine and quiet passages; kickoff; temporal onset, weakening and resolution; a backward seek; a substitution; two balanced seeds; and full time. One balanced seed (8911) repeats an earlier baseline and one (73129) is new to the live evaluations inspected. Fan and Analyst modes are included.

Five explicit challenge fixtures use canonical synthetic events following the existing adversarial test architecture. They are deliberately sparse and labelled test-only. They do not modify the shipped generator or claim to be natural match distributions. Other states use the original generated data unchanged. Multiple timestamps of one match are correlated observations, not independent matches. This is a small purposive evaluation, not a production reliability estimate.

The actual runner forces the first broad event query. That step is infrastructure-directed. Only a subsequent optional tool selection and the final editorial plan demonstrate model choice. Every selected claim must survive the existing independent replay and hypothesis verifier. Public factual prose, significance, caveats, storyline state and watch criteria are deterministic templates. Their quality can improve the product without demonstrating deeper model reasoning.

After inspecting the primary favorite-player outcome, the reviewer found that Leon Costa had only one recorded pass in that state. One **supplementary diagnostic**, `active-favorite-theo`, therefore repeats the same pressure fixture and cutoff with Theo March selected. Theo has nine pass attempts, two shots, two recoveries, two carries and one interception in the review window. This is a post-declared coverage repair, not part of the original 18-state matrix or an independent match. The new input is frozen in a separate supplement file, uses the unchanged generator, and shares the same $2/60-request journal. It is not a rerun of a failed case and is labelled separately in the scorecard.

The harness calls `investigate` directly to expose rejection reasons and uncached model behavior. An isolated evaluation transport enforces this study's limits. Production Redis/application counters are neither reset nor changed. When investigation fails, the report includes a separately computed deterministic fallback, clearly marked as such; it does not pretend the live application fallback path ran. Empty candidate states use the normal no-call gate. Rewind removes future events and checks prefix invariance; it is not a browser-session test or proof of identical stochastic model selection.

## Preflight, spending and stopping

Azure management reads confirmed the existing `between-the-lines-gpt54-mini` deployment, GPT-5.4 Mini `2026-03-17`, GlobalStandard, capacity 10, West US 3, with 10 requests/minute and 10,000 tokens/minute. A server key was available through the already authenticated Azure CLI and was passed only in the child process environment. No key is printed or written to an artifact. The local app remains AI-disabled with its pre-existing limits; no cloud resource, tier, quota, deployment or public inference setting is modified.

Published estimate rates are $0.75/M input, $0.075/M cached input and $4.50/M output. Sources: [Microsoft Mini announcement](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/introducing-openai%E2%80%99s-gpt-5-4-mini-and-gpt-5-4-nano-for-low-latency-ai/4500569), [Microsoft quota documentation](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/quota?view=foundry-classic). Estimates are not invoices. Quota token estimation differs from billed usage.

The new fixed journal is `artifacts/pr18-intelligence-2026-10-10/ledger.jsonl`. Historical ledgers retain their original hashes. This journal:

- holds a single-writer lock and fsyncs each append before HTTP;
- counts every sent attempt, including errors, rejections and diagnostic runs, toward the fixed 60-request limit;
- reserves one input token per UTF-8 request byte plus 8,192 protocol tokens, with the full 1,800-output-token ceiling and no cache discount;
- refuses the next request if reserved/accounted study cost would exceed $2;
- settles only validated returned usage; unknown usage or crashes retain the full reservation;
- fails closed on invalid accounting, corruption, impossible usage, unsafe destinations and stale locks;
- never resets or replaces the study journal to gain allowance.

The maximum envelope reservation is $0.112548 per request. Sixty maximum-size unresolved requests would require $6.75288, so the money gate necessarily stops before that: $2 is the enforced cumulative maximum estimate, not a promise that all 60 requests will fit. The matrix has at most 54 requests before no-call gates, absent any later explicitly recorded diagnostic attempts. There are no automatic paid retries.

Requests are spaced at least 6.1 seconds apart and workflows start at least 65 seconds after the previous request reservation. Request-level pacing is included in workflow latency; inter-case cooldown is excluded. Provider-only HTTP latency is reported separately. The unchanged runtime still limits each transport request to 18 seconds and each investigation to 55 seconds. A large request can exceed the deployment's token allowance even after a cooldown; such failures remain visible.

To stop: create `artifacts/pr18-intelligence-2026-10-10/STOP` or interrupt the process. The current request retains its reservation until verified usage is available. Never remove a lock while a writer is active. Never delete the journal or reuse a new path to extend this authorization.

## Reproduction

Offline budget tests: `npx vitest run tests/intelligence-ledger.test.ts`.

Offline preparation: `SECOND_LOOK_PREPARE_INTELLIGENCE=yes npx vitest run --config vitest.intelligence-live.config.ts`. This validates the implementation hashes and input matrix and forbids network access. Existing prepared inputs and case results are not silently overwritten.

Live execution requires `SECOND_LOOK_AUTHORIZE_INTELLIGENCE_LIVE=yes`, the exact server-only Foundry environment, a current sanitized `preflight.json`, and the same durable journal. `SECOND_LOOK_INTELLIGENCE_CASES` can select not-yet-run cases; completed cases are skipped rather than overwritten. Reproduction after this authorized study is closed requires new explicit user authorization; these instructions are not standing spending permission. Ordinary tests and CI do not load this live config.

The single diagnostic uses `SECOND_LOOK_INTELLIGENCE_SUPPLEMENT=active-favorite` with the same preparation/live commands and ledger. It can add at most three requests to the primary matrix's maximum of 54 before no-call gates. The global 60-request/$2 gates still apply to all attempts together.

The current matrix was frozen before the first paid request. Post-processing can be repeated without inference. The coordinator package records source/version mappings; the reviewer HTML intentionally omits them. Use only project-owned synthetic evidence in the shareable review.

## Rubric: assistant preliminary assessment and independent human review

Score applicable outputs from 1 to 5. Use N/A when there is no suitable output or the dimension does not apply. A rejected model plan is not given an invented quality score; its failure is measured separately. Evidence score 5 means verified within the supplied synthetic record, not real-world football truth.

| Dimension                 | 1                                          | 3                                         | 5                                                                   |
| ------------------------- | ------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------- |
| Football relevance        | Routine/irrelevant or misses the key event | Useful descriptive context                | Selects the most important development with the right qualification |
| Explanatory value         | Misleading or just a count                 | Explains a relationship or material limit | Helps the viewer understand significance and competing evidence     |
| Evidence grounding        | Unsupported/future/incorrect evidence      | Traceable but incomplete or unclear       | Every public claim reproduces and relevant limits are explicit      |
| Editorial quality         | Repetitive, confusing or misplaced         | Coherent but needs editing                | Concise, specific and proportionate                                 |
| Narrative continuity      | Stale/repeated/contradictory update        | Consistent with the current state         | Clearly explains emergence, weakening or resolution                 |
| Personalization relevance | Forced or invented favorite story          | Relevant preference acknowledged          | Useful contribution adds insight without hiding match context       |
| Broadcast usefulness      | Unusable or misleading                     | Producer must substantially edit          | Timely, clear and ready to adapt for a broadcast                    |

Automated checks cover evidence membership, cutoff, independent hypothesis recomputation and journal limits. Relevance, appropriate silence, missed stories, duplication and broadcast value are assistant judgments until people review them. Do not combine them into an accuracy percentage. No extra LLM evaluator calls are made.

Report the full denominator for accepted investigations, editorial rejections, provider failures, no-call abstentions and skipped states. Count meaningful counter-evidence investigations only when the model actually chose the tool and received a relevant assessment; automatic final caveats do not qualify. Distinguish model-requested follow-ups from the forced first query. Cost per accepted investigation includes failures; unknown-usage reserves are included in a second, conservative figure. Median and nearest-rank observed p95 are descriptive only, with sample size and pacing disclosed.
