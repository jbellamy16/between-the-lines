# Foundry live evaluation — October 10, 2026

## Director 1.2 integration update — October 10, 2026

This implementation retains the existing Microsoft Foundry Azure OpenAI resource endpoint, `api-key` server authentication, deployment-name model routing, Responses function calls and strict structured editorial output. It adds a selectable `inspect_counter_evidence` tool and supplies compact measured storyline context to the investigator. A fresh deterministic assessment verifies every published hypothesis, including the offline fallback. Tool and request ceilings remain four and three; no paid retries, quotas, Redis controls or provider enablement settings changed.

The model decides which unresolved question deserves the remaining tool turn and which retrieved observations deserve publication. Deterministic code computes counts, assesses counter-evidence, reconstructs temporal states and renders factual language. The bounded loop is agentic investigation; six logical responsibilities do not imply six model agents. No live evaluation of version 1.2 occurred during this implementation. Prior live results below apply to earlier versions only. The new scripted transport tests prove wiring and rejection behavior, not model preference or latency.

### Framework decision

Microsoft's [Responses reference](https://learn.microsoft.com/en-us/rest/api/microsoft-foundry/azureopenai/responses) documents function tools and JSON-schema response formatting, which match this application's existing boundary. Microsoft's [agent quickstart](https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/responses-api) distinguishes the Azure OpenAI endpoint from the project endpoint and describes Agent Framework's tool wiring and orchestration. [Sequential workflow orchestration](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/sequential) is useful for composing separate agents. These sources were checked October 10, 2026.

Engineering decision: retain the three-request local orchestrator. This small TypeScript workflow already owns cutoff safety, replayable queries, cancellation, quotas and verification. A framework migration has no demonstrated quality or cost advantage here. Project-level managed tracing, identity and hosted orchestration are future commercial options requiring an explicit infrastructure review; they are not implemented or claimed. This is a scope assessment, not a benchmark against Agent Framework.

Mini remains selected based on the earlier [paired model evaluation](EDITORIAL-MODEL-COMPARISON.md). More fluent free-form prose is deferred: claim references cannot prove that an arbitrary generated sentence is true. The new constrained significance/watch-next renderer can be evaluated offline without weakening that boundary. A new paired live study requires a separately authorized, bounded allowance and a human football relevance review.

See [implementation and quality targets](intelligence/EVOLUTION.md) and the [reproducible synthetic demonstration](intelligence/DEMO.md). This change does not deploy the application or enable public inference.

---

Owner request: measure actual costs and put the analysis through its paces. This was an isolated, bounded evaluation against the existing Azure model deployment. Public AI stayed disabled, with zero application quotas. These local fixes have not been redeployed to Azure.

Follow-up: the [editorial rules and model comparison](EDITORIAL-MODEL-COMPARISON.md) documents later fixes, real GPT-5.4 versus Mini results, and the decision to keep Mini configured. The results below describe the earlier diagnostic session.

## Result

All 14 planned cases have a passing result after diagnostic fixes and paced reruns. This is **not 14 uninterrupted first-attempt successes**: 22 workflow attempts included two rejected editorial plans and one Azure 429 response. Accepted results passed the evidence contract, but editorial quality is not yet good enough to claim “spot on” or superiority over the deterministic baseline.

The provider was `between-the-lines-gpt54-mini`, GPT-5.4-mini version `2026-03-17`, GlobalStandard, on the existing West US 3 Foundry resource. There were 43 HTTP attempts: 42 returned 200 and one returned 429. No alternative model was tested.

## Measured cost and latency

- Returned usage: 282,327 input tokens, including 38,784 cached tokens, and 2,570 output tokens.
- Estimated token charges: **$0.19713105**, including the two rejected editorial plans and all diagnostic reruns.
- The 429 returned no usage. Its conservative **$0.01831575** reservation remains charged against the evaluation allowance; it is not silently counted as free. Known estimates plus this reserve total **$0.21544680**, below the $1 estimated allowance. The persistent ledger enforces at most 48 requests across reruns.
- Simple recaps: **0.263–0.265 cents** each. Accepted investigations: approximately **0.589–1.838 cents** each. Two cases needed no provider call.
- Latest accepted provider workflows took **2.9–5.8 seconds**, excluding deliberate pacing between cases. This small sample does not establish production p95 latency.

Estimates use returned usage and Microsoft's published GlobalStandard GPT-5.4-mini rates: $0.75/M uncached input, $0.075/M cached input, and $4.50/M output. [Microsoft pricing announcement](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/introducing-openai%E2%80%99s-gpt-5-4-mini-and-gpt-5-4-nano-for-low-latency-ai/4500569). Billing invoices, taxes and negotiated rates were not inspected. Caching varied between runs, so these are observations rather than fixed per-click prices.

## Latest passing result for each planned case

| Case                | Requests | Estimated cents | Seconds | Report phase    |
| ------------------- | -------: | --------------: | ------: | --------------- |
| pressure-fan        |        2 |           0.659 |   3.499 | smoke-final     |
| pressure-analyst    |        3 |           1.670 |   5.066 | smoke-final     |
| kickoff-abstention  |        0 |           0.000 |   0.001 | broad-fixed     |
| quiet-fan           |        2 |           0.589 |   3.036 | broad-fixed     |
| quiet-analyst       |        0 |           0.000 |   0.003 | broad-fixed     |
| before-substitution |        3 |           1.698 |   5.759 | broad-fixed     |
| after-substitution  |        3 |           1.838 |   4.713 | broad-fixed     |
| unfamiliar-fan      |        2 |           0.907 |   3.202 | broad-fixed     |
| unfamiliar-analyst  |        2 |           0.876 |   2.934 | broad-fixed     |
| full-time           |        2 |           0.817 |   2.927 | broad-fixed     |
| player-preference   |        3 |           1.556 |   4.296 | remaining-fixed |
| historical-fan      |        2 |           0.837 |   3.447 | remaining-fixed |
| recap-fan           |        2 |           0.263 |   3.823 | remaining-fixed |
| recap-analyst       |        2 |           0.265 |   3.381 | remaining-fixed |

The sample covers Fan/Analyst pressure, a quiet kickoff and ending, quiet passages, immediately before/after a recorded substitution, two unfamiliar balanced-generator seeds, full time, player/team preference, Arsenal–Leicester Wyscout fixture 2499719 at 30:00, and the two legacy recap modes. Source licensing restrictions were preserved. No restricted StatsBomb data was submitted.

## Failures found and changes made

1. **Presentation mismatch:** a pre-substitution response selected a shot sequence with comparison emphasis. The verifier rejected it. Evidence tools now supply the permitted emphasis from the same category mapping used by validation, and the prompt explicitly requires copying it. The corrected case passed live; an offline regression preserves the rejection boundary.
2. **Fan story overflow:** the favorite-player response selected three stories despite the two-story Fan limit. The verifier rejected it. Provider structured output now enforces audience-specific `maxItems`, with both audience limits tested. The corrected preference case passed live.
3. **Azure token-rate limit:** rapid workflows exhausted the deployment's estimated token-rate allowance. The diagnostic runner stopped immediately and subsequently paced cases by 20 seconds. Production still has no automatic paid retries. This is a throughput quota issue, distinct from insufficient credits.
4. **Vague time windows:** Fan comparison wording now includes the actual start/end clock times instead of saying only “selected window.”

Director prompt/cache version is `director-1.0.2`. No validation was weakened to accept failed outputs. All previous attempts remain in the ledger and original phase reports. The deployment capacity was temporarily increased for testing and then restored to its original 10 units; that low throughput allocation will need deliberate sizing before sustained public investigations. No provisioned-throughput purchase or new hosting resource was made.

## Assistant editorial review — human sign-off remains pending

Accepted narratives preserved the recorded score/latest goal, respected the playback cutoff and source capabilities, and rendered validated event-based claims. Prefix invariance checks removed future events without changing the observer. Full-time narratives suggested revisiting recorded play. The pre-substitution case did not announce the later change; the post-substitution case explicitly avoided claiming a causal effect. No unsupported fact was identified in the inspected accepted sample. This does not guarantee correctness of all source data or templates.

**Editorial quality remains the limiting factor.** The final Fan pressure recheck chose these two statements:

> Harbor completed 6 recorded passes in the possession before this shot. Harbor completed 4 recorded passes in the possession before this shot.

Each statement has separate valid evidence, but the narration is repetitive and “this shot” is ambiguous outside its individual replay card. It also omits the more useful four-shots-versus-zero and high-recovery comparison selected by the simpler baseline. Earlier runs selected those stronger comparisons, demonstrating unstable editorial preference across repeated calls.

The Analyst outputs provide timings and limitations but repeatedly describe passing passages. Favorite-player preference did not yield a clearly player-specific explanation. Historical output accurately selected increased Arsenal shots and forward passes while preserving Leicester's 2–1 lead, but generic “why/watch” text adds little. Quiet passages reported recorded events without inventing a tactical shift; this does not establish that every highlighted quiet event deserves attention.

Assessment: the factual constraints are useful, but this sample does **not** establish better story selection than deterministic ranking. Improve selection diversity, event identification in combined recaps, and relevance to the current match situation before expanding AI scope. A larger model has not been shown necessary or superior by this test. Human football review and the existing production usage-store gate remain pending.

## Verification and reproduction

- Type checking and production build passed.
- 304 unit/API/integration checks passed; two optional environment/data-dependent checks skipped. This includes the 200-case director matrix and 180-case narration matrix, which are offline contract evaluations, not additional paid calls.
- 12 focused production-browser checks passed across desktop, Android-sized and iPhone-sized Chromium, including evidence presentation/accessibility and rewind behavior.
- Public `/api/insights` remains offline; public inference flags and quotas were not enabled by the test.

The separate `eval/foundry.live.eval.ts` / `vitest.foundry-live.config.ts` harness never runs under ordinary tests or CI. It requires explicit authorization via `SECOND_LOOK_AUTHORIZE_FOUNDRY_LIVE=yes`, the exact Foundry endpoint/deployment, a server-side key, and local-only memory usage settings. `SECOND_LOOK_FOUNDRY_PHASE` selects a distinct output report; `SECOND_LOOK_FOUNDRY_CASES` optionally names cases for diagnostic resumption. `smoke*` phases select the two pressure modes; other phases select the broader matrix. Run with `npx vitest run --config vitest.foundry-live.config.ts` only within an explicitly authorized allowance. Do not delete/reset its dated ledger to evade cumulative limits.

Ignored local artifacts: `artifacts/foundry-live-2026-10-10-ledger.json`, `artifacts/foundry-live-{smoke,broad,broad-fixed,remaining,remaining-fixed,smoke-final}.json`, and `artifacts/foundry-live-summary.json`. Reports retain safe public outputs, usage, tool evidence, baselines and failures, without API keys or private reasoning. Human review fields remain null. These artifacts are not deployed with the application.
