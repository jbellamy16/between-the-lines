# Bounded Foundry study — October 11, 2026

This harness implements the six-case evaluation authorized after PR #24. It calls the current `directMatch` runtime in **analyst** mode, including application eligibility, cache, shared workflow controls, per-attempt accounting, pacing, cooldowns, retries and verification. Historical case names do not select legacy Fan mode. The old recap and Director live commands are different studies.

The fixed output is `docs/intelligence/foundry-bounded-2026-10-11`. Existing receipts cannot be overwritten and the journal has no reset option. This study is not standing authorization for another paid campaign. Review its saved preflight and report before any future action.

## Commands and interpretation

```sh
# Offline tests: HTTP is scripted; no credentials or network needed.
npx vitest run tests/foundry-study.test.ts

# Commit a clean candidate first. Reads Azure management and public prices,
# freezes the candidate, checks fixtures and renders deterministic explanations.
# Does not make provider calls, enable AI or change persistent settings.
SECOND_LOOK_BOUNDED_FOUNDRY=prepare npm run eval:foundry:bounded
```

The separate `live` mode requires explicit owner authorization, an unused receipt path for this exact study, a fresh passing preflight, the frozen existing deployment and credentials supplied privately to the process, and **existing shared application allowance** sufficient for six workflows / twelve attempts. It does not retrieve credentials, create a store, alter quotas, reset counters, or deploy anything. Running against memory counters cannot establish remaining durable allowance and fails preflight. `prepare` consumes no allowance but closes its journal; do not delete its receipts to turn it into a live campaign.

## Explicitly authorized continuation

The owner subsequently authorized **one** continuation of the blocked, zero-spend preparation: `foundry-bounded-2026-10-11-continuation-1`. Its parent index hash is pinned in `continuation.ts`; every parent receipt must match, and its journal must contain only initialization and the blocked stop. The six-workflow, twelve-attempt, $0.50 caps therefore cover the entire linked study. No automatic second continuation, fresh path, reset or rerun is available.

A dedicated Docker Redis service publishes only `127.0.0.1:16379`, with a named persistent volume, AOF enabled, `appendfsync always`, rewrite fsync enabled, no eviction and no automatic restart. The setup receipt is `docs/intelligence/foundry-continuation-setup-2026-10-11.json`. Initialization is explicit and atomic, requires a completely empty dedicated database, and creates every application counter plus a study ownership record. Existing, incomplete, corrupt or expiring counters are never interpreted as fresh or repaired. The live process validates durability and ownership before every workflow and dispatch, then reconciles application totals against the journal. A permanent execution claim bound to the frozen manifest prevents a rerun even if local receipt files disappear. Keep the volume and stopped container afterward.

`node scripts/run-foundry-continuation.mjs` retrieves the existing key in memory and supplies it only to the evaluation child process. Its fixed process limits are **2/minute, 12/hour, 12/day, 12 total, 10 requests/minute, 10,000 tokens/minute**. The smaller six-workflow ledger cap remains independent. It never edits `.env.local`, hosted settings or Azure capacity. Run only within the owner's single-use authorization, after committing a clean candidate; saved receipts or an existing execution claim refuse another run.

`FOUNDRY_STUDY_REDIS_TEST=1 npx vitest run tests/foundry-study.test.ts tests/foundry-continuation.test.ts` tests fresh initialization, durable counters/claim across actual restarts, existing/corrupt state, application quota exhaustion, retries, unknown usage, cancellation and fixed parent linkage. Destructive state tests create and remove only their own disposable container and never use the study allowance. Required CI enables these tests. Safe provider receipts include numeric usage/status/latency, typed tool queries and short editorial claim aliases; reasoning, raw error text and credentials are excluded.

A passing harness command means it produced receipts. It does **not** mean the live acceptance criteria passed: inspect `results.json`. A blocked campaign records all six cases as not attempted, with zero workflows, provider attempts and spending. Offline fixture checks are not live abstentions. In an actual campaign, a runtime no-call eligibility decision is an abstention; a cached result is not fresh provider evidence.

## Spending bound and accounting

Microsoft's [model specification](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-54) lists a 400,000-token context and a smaller 272,000-token input maximum for GPT-5.4 Mini `2026-03-17`. The guard deliberately reserves **all 400,000 tokens as uncached input**, plus the runtime's full 1,800-token output cap. At the currently checked Global Standard West US 3 [Microsoft retail meters](https://prices.azure.com/api/retail/prices), $0.75/M input, $0.075/M cached input and $4.50/M output, each request reserves **$0.308100**. This bound covers full input, instructions, tool schemas, history and protocol framing without estimating tokens from bytes. The extra full output reservation overstates the shared context. The runtime's request-size heuristic remains solely a throughput safeguard.

Only the existing text Responses workflow and local function tools are permitted. No background requests, conversation IDs, built-in paid tools, alternate service tiers or model changes are allowed. Requests retain the existing 131,072-byte ceiling and 1,800 output-token cap. Output usage includes the provider's metered output, including reasoning tokens, without saving private reasoning.

Before each actual dispatch the single-writer journal appends and fsyncs a reservation and dispatch marker. Integer nanodollars enforce **$0.50**, **twelve attempts including retries**, **six workflows**, and **three attempts per workflow**. Hash chaining, metadata checks, strict schemas and state replay reject corrupt, incomplete or mismatched journals. Crashes, unknown usage and cancellation retain the full reservation. Stale locks require diagnosis; there is no automatic lock removal after a crash.

Validated usage settles at the **uncached** input rate for conservative study accounting; the reported usage estimate separately includes any published cache discount. Both are token-rate estimates, not an invoice, and exclude unrelated hosting, tax and negotiated contract effects. Gross reservations are historical totals; the ceiling applies to settled conservative charges plus outstanding reservations at every dispatch. Known usage normally releases enough reserved headroom for another case. An unknown first request leaves $0.308100 reserved, so another full-context reservation cannot fit and is refused. A 429 retry is possible only if both the unchanged runtime and this stricter money guard allow it.

## Evidence and stops

The manifest fixes commit, source/prompt hashes, Director version, fixture hashes, deployment/model/version/SKU/region, prices, application limits and predeclared cases before dispatch. The diagnostic quality fixture restores only missing synthetic source wrappers in memory. Other fixtures are regenerated from their current seeds and every saved event field is compared. Independent direct event filters check the proposal's familiar counts, xG and five-minute recovery history; unfamiliar seeds retain their own outcomes.

Each original runtime result is saved before evaluation. Fresh tool replay against prefix-only events rechecks retrieved IDs, measurements, hypothesis qualifications, full story packages and source precision. Both explanation styles and the exact Quick/Full field selections are rendered locally. Required lead qualifications must survive recap presentation. Tests verify server cache reuse without another HTTP request. Browser interaction coverage remains in the existing explanation/recap suites; this harness alone is not a new browser-session study or human wording review.

Workflows start at least 65 seconds after the previous workflow completes; provider cooldowns still apply inside the runtime. Every terminal provider/runtime failure, unsupported/future claim, missing material qualification, accounting inconsistency, cancellation leak or study ceiling stops later paid cases. The harness never manually retries a failed case or substitutes one. Send SIGINT/SIGTERM to abort active work, or create `STOP` in the receipt directory to prevent the next workflow. Unknown reservations remain charged.

Historical receipts and allowances are separate and must remain unchanged. Six successful cases would still not establish production reliability, p95 latency, human preference, or deployment parity.
