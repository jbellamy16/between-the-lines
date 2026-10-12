# Frozen Foundry editorial candidate

**Prepared and tested offline; live evaluation is blocked. No paid inference is authorized or performed.** This candidate supersedes PR #41's proposed evaluation without changing any historical artifact. It includes PR #42's verified editorial renderer. B2, application code, public routes, provider controls and historical study implementations are unchanged.

PR #42 was reviewed at `7771a476d55a78d8d8beff57e6ab4bd755f07704`: no blocking findings, all four GitHub checks successful, and 115 focused tests passed. It was squash-merged as `422a5b33ed845bc4930528ab872a033ef15cd984`. This branch was created from fetched `origin/main` at that merge in a separate worktree. The original branch and local `next-env.d.ts` edit remain intact.

## What is frozen

`frozen.json` contains the complete synthetic fixtures, source prefix/cutoff/preferences, catalogue, initial evidence, every available evidence bundle, unchanged B2 decisions/stories/answers, all six B2 presentations, shared presentation constraints, renderer version, preregistered criteria, and SHA-256 source hashes. It also pins every existing tracked historical intelligence artifact. The source inventory includes application, evaluation, scripts, tests, browser checks, package lock and CI configuration. Missing, added or changed source files block live execution before authorization or accounting.

The candidate identity is SHA-256 of `JSON.stringify(parsedFrozenJSON)`:

`c1e06e3a397bada88b59958ef41b217cd0141fdab62e11eaa115d58d10d05496`

A future authorization must bind this identity **and the full reviewed execution commit**, not merely a branch name. No authorization file is committed. `offline-measurements.json` contains actual local B2 timings and zero provider cost. Actual model selections, model usage, model latency/cost and human preferences remain null/unmeasured.

The existing historical PR #41 freeze retains byte SHA-256 `33aef062567387734bad6bd0f80ecbf8f50c51465e87481109d576ca3b85dfbf`; its old runner still rejects its original source drift. Its proposal has not been refreshed, reauthorized or relabeled as a result of this study.

## Meaningful editorial choice

The new authored development scenario uses the existing `spread-favored` synthetic fixture at 30:00, score 0–0, with Harbor preferred. Harbor shots increase 2→6, with its current halves at 3→3; Riverside increases 1→5, with current halves at 2→3. Per-shot source xG remains 0.1. Harbor's recovery-to-shot route increases from zero to two separate linked possessions.

Two interpretations of the same Harbor lead are canonically **supported**: `repeated-route` and `both-teams`. The `concentrated-attempts` interpretation is **limited**. This permits a substantive emphasis choice between repeated possession patterns and a more open, two-sided game. Neither supported interpretation is preregistered as the winner. Repetition does not establish pressing, causation, dominance or future continuation.

Unchanged B2 leads with “Harbor: more shots,” retains its two successful evidence reads and all guided answers, and foregrounds opponent improvement, chance quality and competing explanations. Its PR #42 presentation adapter focuses the supported repeated-route interpretation first. The investigator receives the identical catalogue and all B2 calculations, references and qualifications; optional initial display rows are omitted on the existing wire protocol, with that omission disclosed. Every available full bundle is frozen for audit. B2 is never denied factual evidence to create a model advantage.

A separate `quiet-no-call` fixture contains no events. It runs in normal mode with fetch prohibited and must return no stories/answers and zero requests. This demonstrates deterministic application behavior, not model restraint.

## Matched presentation and human review

Both arms use the unchanged PR #42 renderer, version `offline-editorial-1`. Casual Viewer, Football Fan and Advanced Analysis each have brief/detail views with shared 1,800/2,600-word ceilings. Every distinct mandatory support, counter-observation, alternative, uncertainty, measurement and comparison window remains visible. Overflow blocks the pair; nothing is truncated. These are exhaustive review limits, not product length settings.

The primary judgment is **Casual Viewer / brief**. Other views are sensitivity checks of the same case, not independent trials. Reviewers rate each arm 1–5 on useful prioritization, clarity, visibility of counter-evidence and calibrated uncertainty; record A/B/tie/cannot assess; and quote exact wording from both arms. Collect responses before unblinding. After unblinding, classify improvement/parity/regression/inconclusive. Improvement requires a material usefulness benefit absent from B2 with no lost caveats or unsupported conclusions. Different statistics, IDs, retrieval counts or secondary ordering alone earn no improvement credit. A valid plan or safely rejected plan is not proof of model value.

`mock-review/` contains six anonymous A/B examples and reviewer instructions from an authored mock run. **They are mock workflow demonstrations, not actual Foundry results.** Share only that folder for a dry review; do not give reviewers this README, the freeze, or `private/`. `private/mock-key.json` contains the randomized assignment seed, counterbalanced side assignments and HTML digests; `private/mock-summary.json` retains the submitted mock plan, receipt and observed differences. Mock usage/accounting is simulated and must never be reported as live model performance. The complete locally generated mock audit remains under `artifacts/frozen-editorial-mock-review/` and is reproducible:

```sh
node --conditions=react-server --import tsx scripts/mock-frozen-editorial.ts artifacts/new-mock-review
```

The output directory must be new. This command overrides ambient transport, Redis and credentials with ephemeral mocks and never reads an authorization file. The actual investigator, transport gates, canonical verifier and PR #42 renderer run against injected responses. Generated HTML has no scripts, remote assets or submission destination. Entered ratings are not saved; collect them separately or print.

## Future execution and measurements

The standalone live entry is deliberately absent from npm scripts and normal CI/Vitest discovery. It rejects CI, GitHub Actions, Vitest, test mode, noninteractive stdin/stdout, wrong arguments, an unclean working tree, changed freeze/source inventory, stale authorization, missing durability/ownership and drifted deployment/pricing. It requires an interactive confirmation of the exact manifest. It changes Foundry selection only inside that authorized terminal process and never enables a public route.

After **separate explicit authorization and resolution of the infrastructure blockers**, an owner may invoke:

```sh
node --conditions=react-server --import tsx scripts/run-frozen-editorial.ts --authorization-file /absolute/path/to/new-owner-authorization.json
```

Required authorization fields are `study` (`foundry-editorial-candidate-2026-10-12`), `manifest`, full `commit`, UTC `expiresAt`, `redisIdentitySha256` (hash of the exact existing URL, never publish the URL), `existingOwnerKey`, `existingOwnerIdentity`, `maxAttempts` (1–2) and `maxNanoUsd` (positive, at most 500000000). Previous study authorizations fail the distinct study schema. Existing historical study or evaluation claims cannot serve as the owner. A fresh single-use claim/journal is created only during a separately authorized run; there is no allowance initializer or counter reset.

The maximum remains **$0.50 and two HTTP attempts, subject to every lower existing limit and authorization cap**. Frozen application ceilings are `[2,2,2,2,30,30000]` for minute/hour/day/total workflows and request/token throughput. The existing atomic Redis accounting script is reused without alteration. Durability requires a complete, nonexpiring allowance/owner, synchronous AOF (`appendfsync=always`), no eviction, successful writes and no loading. Historical study databases are refused. Unknown usage retains the full $0.3081 reservation and stops; HTTP errors, parse errors or accounting uncertainty cause no retry. A second reserve must still fit under the remaining cap. One request with a cap below $0.3081 cannot be dispatched.

Future execution writes an exclusive `artifacts/foundry-editorial-candidate-2026-10-12-execution/` directory:

- `private/transport-events.jsonl`: synchronously flushed request intentions, exact request bodies (without credential headers), structured provider output/usage, no-call output and actual investigator output. No hidden reasoning is requested. A dispatch intention is not itself proof of a completed HTTP request. Crashes retain the durable reservation and prohibit resume.
- `private/result.json`: original runtime receipt, actual stories/answers/score, full initial and selected evidence, trace, verification, counter-evidence selections, stopping origin, each actual transport attempt, provider model/response IDs when supplied, token usage, per-request latency, total investigator time and durable accounting reconciliation. Missing usage stays unknown.
- `private/presentations.json` and `private/key.json`: canonical renderer replay, actual displayed explanations and textual difference classes, assignments, seed and HTML digests. Renderer audit counters describe the offline rendering step; execution accounting is in the result and execution audit.
- `review/`: anonymous paired HTML and the preregistered reviewer instructions. A cancelled run creates no comparison; invalid decisions yield a safe B2 fallback with rejection retained privately and no capability credit. Overflow withholds the pair.

Conservative cost prices all input uncached; usage-based estimated cost separately reflects reported cached tokens. Neither is an invoice. Operational validity requires uncached verified model selection, complete usage, reconciled requests/tokens/reservations and all caps satisfied. Human editorial usefulness remains a separate judgment. More reads, a forced final at the attempt cap, or identical output cannot earn model-stopping or quality credit.

## Current read-only readiness

`read-only-readiness.json` records the current inspection. The existing westus3 Foundry deployment is `between-the-lines-gpt54-mini`, model `gpt-5.4-mini`, version `2026-03-17`, GlobalStandard, capacity 30, 30 RPM/30,000 TPM. Current Microsoft retail rates match the frozen $0.75/M input, $0.075/M cached input and $4.50/M output. Recheck them before any later launch. Hosted AI is disabled and hosted workflow limits are all zero.

**Live evaluation is not technically ready in the current environment.** Local accounting is memory-only and no `AI_REDIS_URL`, Foundry endpoint/deployment/key or candidate authorization is configured. Read-only connection attempts to the known historical Redis endpoints at localhost:16379 and :16380 failed. Docker metadata confirms both historical containers are stopped. Their current counters and remaining allowances are therefore **unknown**, not zero or available. They were not restarted; counters, owner records, persistent configuration and resources were not changed. Even if reachable later, those historical allowances cannot authorize this candidate.

The smallest safe next option is:

1. Have the owner identify an **already existing, nonhistorical durable allowance** with verified owner identity and at least one remaining workflow and HTTP attempt, and provide existing local Foundry configuration. No credentials need to be retrieved by this preparation task.
2. Separately authorize this exact reviewed commit/manifest for **one workflow, one HTTP attempt and a $0.3081 maximum** (or the original two-attempt/$0.50 envelope if expressly preferred), retaining all lower limits. One attempt is final-only and earns no voluntary-stopping credit, but can compare editorial emphasis using the already complete initial evidence.
3. If no suitable existing allowance exists, a spending authorization alone is insufficient. The smallest additional infrastructure decision is explicit permission to establish one isolated durable allowance and owner on an appropriate already-owned Redis service, without touching any historical database, claim or counters. If no appropriate service exists, separately approve its provisioning too. Neither permission is included in this task; no initialization or provisioning was performed or implemented here.

## Validation

TypeScript, 850 unit tests and the production build pass. Eleven existing environment-dependent tests skip locally, including atomic Redis tests that require the ordinary CI test service; no service was provisioned for them. The unchanged atomic script is covered by those existing CI tests. The new 25 tests exercise source/fixture/renderer freeze checks, two supported interpretations, complete evidence, valid and invalid plans, mocked end-to-end output, blinded assignments, distinct authorization, CI rejection, lower caps, unknown usage, HTTP failure, selected reads, forced final, and cancellation with late responses.

Browser validation covers generated candidate artifacts, PR #42 artifacts, accessibility, responsive layouts, normal styles, Foundry recovery/cancellation/cache behavior and recorded-match rewind. All 87 relevant browser checks passed across desktop and two mobile sizes. This is one authored synthetic case and one deterministic control; it establishes reproducibility and readiness boundaries, not generalization or superiority over B2.
