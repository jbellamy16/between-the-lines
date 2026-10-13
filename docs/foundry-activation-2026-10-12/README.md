# Explicit Microsoft Foundry investigation: application integration

Prepared October 12, 2026 (America/Chicago). **Review candidate; not deployed. The investigator has not yet completed a successful real investigation.** Two separately approved real calls authenticated: [GPT-5.4 Mini](first-real-investigation/README.md) and the owner's newly deployed [GPT-6 Luna](luna-real-investigation/README.md). Both were rejected before evidence retrieval; B2 fallback was retained. Combined token-cost estimate: **$0.011098425**. The same $1 ledger retains **$0.62** in nonrefundable reservations; historical counters were preserved. Local inference is stopped. The simplified explicit tool interface has not had a paid retest.

**Hackathon recommendation: defer buying Redis hosting.** Redis here is the shared spending ledger, not the AI. A durable local instance allowed the first real test at **$0 incremental recurring cloud cost**. Another test needs investigation/spending approval, not a new Azure service. The hosted estimate below is an optional public activation path, not a prerequisite for proving model behavior. The proposed $10 campaign remains unapproved.

## Implemented

The synthetic match story has an **Investigate with Microsoft Foundry** button. A click sends only the selected canonical scenario/profile and exact timestamp to `/api/investigate`. The server reconstructs the source, supplies verified B2 evidence, and connects to the existing bounded investigator from PRs #37–43. Historical IDs, arbitrary evidence, model names, automatic actions, and cross-origin browser calls are rejected. Neither page loading nor playback, navigation, explanation-level changes or ordinary guided questions starts this workflow.

The existing model loop can select registered evidence options, execute their bounded tools, revise the focal interpretation after retrieval, examine competing explanations and challenges, and propose a stop. The explicit model chooses option/focal IDs; code supplies canonical index/purpose metadata and leaves interpretation selection to the final model plan. Receipts distinguish these deterministic bindings from model choices. The unchanged independent verifier replays canonical evidence before publication, including cache hits. All B2 calculations, mandatory counter-evidence and qualifications remain available. A model choosing no optional tool is reported as such; it is not credited with adaptive investigation. Forced final requests are labeled application stops rather than voluntary model decisions.

The result shows the supported conclusion, initial deterministic evidence, completed model-selected retrievals, event replay links, competing readings, unresolved interpretations, verification outcome, stopping origin, B2 comparison, request/token counts, cost reservation and token cost estimate. A downloadable JSON receipt includes the plan, trace, canonical digests, coverage, original usage, current-request latency and a receipt identifier. Cached results explicitly distinguish the original model work from a new request. No claim of added value follows merely from different story selection.

Separate `AI_INVESTIGATOR_ENABLED` and durable-dollar gates control this entry. Enabling the new flag also forces the legacy provider selector offline, preventing accidental legacy/proactive inference even if old provider flags are present. Normal operation of the bounded runner remains deterministic. No script or mock decision module is imported by application code.

Disabled AI, exhausted limits, Redis failure/busy state, model errors, timeout, and verification rejection retain deterministic B2. Browser transport failure retains the existing deterministic explanation. Cancellation and changing match/time discard pending results. The older optional Foundry story-review button has a distinct label so it cannot be mistaken for this bounded investigator.

## Actual Azure inventory (read-only)

[Sanitized Azure snapshot](azure-readiness.json), collected using authenticated Azure management APIs. Secret values were neither logged nor committed.

- App: `between-the-lines-jb-f5539b65`, `rg-between-the-lines`, West US 3. Existing **F1 Free**, Linux Node 24 LTS, `node server.js`, HTTPS-only, TLS 1.2, Always On off. Keep this plan; cold starts and free-tier capacity remain operational limitations.
- Public release remains commit `10cd0aa68c4f1fab07aef2b244992c46879f44c7`, build `dU8AxOcHi3KhXUbI-NhT3`.
- Foundry account: `josh-5098-resource`, `rg-josh-5843`, West US 3. Existing deployment `between-the-lines-gpt54-mini`: **gpt-5.4-mini**, version **2026-03-17**, **GlobalStandard**, capacity **30**, **30 RPM / 30,000 TPM**. Credentials and endpoint are already present in App Service. Reuse them; do not change the deployment, model, version, capacity or quotas.
- `AI_ENABLED=false`, `FOUNDRY_ENABLED=false`, `AI_PROACTIVE_ENABLED=false`; workflow minute/hour/day/total settings are all **0**. Historical access and recorded navigation are false.
- No `AI_REDIS_URL` is configured. The accessible subscription resource inventory has no Redis, VM or other suitable durable accounting service. No external Redis account was discovered or assumed to exist.

The owner subsequently deployed GPT-6 Luna (`between-the-lines-gpt-6-luna-1`, version `2026-09-22`, GlobalStandard, capacity 1000). Its deployment advertises 1000 RPM/1,000,000 TPM; application limits stay at 30 RPM/30,000 estimated TPM. The original Mini deployment remains unchanged. [Luna configuration and pricing](luna-real-investigation/README.md).

## Optional public accounting service — deferred

This workload needs a tiny durable database, not a high-throughput cache: one active investigator, at most 30 provider attempts in the initial proposal, atomic Lua reservations, TLS, no eviction, non-expiring accounting, and acknowledged writes persisted before inference. Unavailability is acceptable because the application falls back; losing acknowledged spending is not.

**If a separate Azure host is later approved, one checked option is a non-Spot Linux ARM64 `Standard_B2pts_v2` VM (2 vCPU, 1 GiB), West US 3, with Redis, a 32 GiB S4 LRS managed OS/data disk, and one Standard IPv4 address.** The SKU inventory reports no subscription restriction for this size. B1s is restricted in both West US 3 and East US; it is not a deployable recommendation here. The usage/quota listing returned no entries, so allocation and family quota must be rechecked before any paid creation; SKU listing is not a capacity guarantee.

This is the lowest-cost suitable **Azure option checked** for the current subscription, not a claim about every provider. It requires owner-operated patching and certificate renewal. It deliberately has no automatic replica failover: stale promotion must never roll accounting backward. Complete disk loss requires disabling inference and reconciling or exhausting the remaining allowance, never restoring an older lower counter and resuming spending.

Required Redis configuration:

- Current supported Redis release with TLS; verify existing Lua/Redis integration tests against it before activation. Application uses its existing TCP client.
- `appendonly yes`, **`appendfsync always`**, `no-appendfsync-on-rewrite no`, `aof-load-truncated no`, `maxmemory 128mb`, **`maxmemory-policy noeviction`**. Store AOF on the managed persistent disk, not an ephemeral/container filesystem. Verify persistence status and a restart before using money.
- TLS 1.2+ on 6380 with a publicly trusted certificate and hostname verification; plaintext port disabled. Restrict network ingress to App Service outbound addresses and the approved test operator. Separate restricted application credentials; no public anonymous access, flush, configuration or administration rights. Use a secret App Service `AI_REDIS_URL=rediss://...`; never place it in the client or a committed file.
- Permanent dollar ledger and existing workflow/request totals have no expiry. Locks, rolling minute windows and result caches retain their existing expiries. Never clear a live database, reset counters, change the budget namespace to obtain more allowance, or reuse historical evaluation allowance.
- Scheduled OS security maintenance and certificate renewal must not enable automatic stale-replica promotion. During any accounting uncertainty, turn the explicit flag off and reconcile before reopening.

Redis documents that `appendfsync always` fsyncs before sending replies. [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).

Cheaper advertised alternatives were considered: Upstash PAYG is $0.20/100K commands, with persistence, but its published replication contract is **eventual consistency** and the former strong-consistency mode is deprecated. It is not selected as the sole authority for this strict monetary ceiling. Azure Managed Redis B0/B1 do not support persistence, so they are not suitable merely because their memory capacity is sufficient. [Upstash pricing](https://upstash.com/pricing/redis), [consistency](https://upstash.com/docs/redis/features/consistency), [Azure persistence](https://learn.microsoft.com/en-us/azure/redis/how-to-persistence).

## Pricing and approval amount

USD public retail prices retrieved from the Azure Retail Prices API; actual negotiated billing, taxes and allocation can differ. [Saved infrastructure meters](infrastructure-prices.json), [saved Foundry meters](azure-prices.json). These are pricing reads, not purchases.

| Item                                 |                      Rate |    Estimate at 730 hours/month |
| ------------------------------------ | ------------------------: | -----------------------------: |
| Linux B2pts v2, West US 3            |              $0.0075/hour |                         $5.475 |
| S4 LRS 32 GiB disk                   |              $1.536/month |                         $1.536 |
| Standard IPv4                        |               $0.005/hour |                         $3.650 |
| Disk operations                      | $0.0005/10,000 operations | Small usage-dependent addition |
| Existing App Service F1              |                        $0 |                             $0 |
| **Incremental fixed infrastructure** |                           |              **$10.661/month** |

Deferred optional authorization, not requested for the local pilot: **approximately $11/month, up to a $12/month estimated run rate before tax**, no upgrades or extra services without approval. This is an estimate, not an Azure hard billing cap; disk operations/egress are usage-based. Redis pauses or inference gating do not stop VM/disk/IP billing. Do not add monitoring tiers, backup services, paid TLS products or another App Service tier under this approval.

Existing Foundry Global Standard Mini meters: **$0.75/M uncached input tokens, $0.075/M cached input tokens, $4.50/M output tokens**. A 10,000-input/1,000-output request would be about **$0.012**, not an observed cost. Azure lists a 400,000-token context and 272,000-token input limit for this model; the spending reservation deliberately overestimates using the entire context as input. [Azure model specification](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-54).

## Enforced initial $10 testing ceiling

The new ledger is `{second-look-ai}:explicit-investigation:usd:v1`. It is separate from all historical study keys, which remain untouched. A fresh local ledger was initialized only after the explicit $1 approval. It now retains two $0.31 reservations ($0.62) and two attempts; the owner separately approved Luna on that same ledger. No hosted ledger has been initialized; no historical allowance or counter was reused or reset.

Each provider attempt, including retries and failed/ambiguous calls, must first acquire an atomic **$0.31 nonrefundable reservation**. This exceeds `400,000 × $0.75/M + 1,800 × $4.50/M = $0.3081`. Thus the cap does not depend on the existing approximate token-pacing heuristic, on successful responses, or on Azure monitoring. A $10 ledger admits at most 32 such reservations ($9.92); the proposed lower total-attempt allowance of 30 limits the pilot further to $9.30 reserved. Actual model charges should normally be much lower; unused reservations are not refunded or reused. Tax and unrelated Azure resources are outside the model-token ceiling.

The Lua gate rejects missing, expired, unapproved, malformed or inconsistent ledgers, the wrong rate card, amounts above $10, and an expired/wrong concurrency lease. It never creates a budget automatically. Redis failure denies dispatch. A 70-second shared lease permits one explicit workflow across instances; every attempt rechecks ownership and remaining transport time. Existing 55-second workflow deadline, 18-second in-workflow transport allowance, 1,800 output-token limit, 131,072-byte request limit, 30 RPM/30,000 TPM ceilings, three HTTP attempts (including retries), two adaptive rounds, four-tool ceiling, canonical checks and existing workflow/request quotas remain in force.

Token usage reported by the provider is captured separately from reservations. Missing or retried usage is incomplete; the receipt never invents a bill. The displayed retail cost estimate deliberately omits cache discounts and is not an invoice. The Mini receipt reports an estimated $0.0101535. Luna reported cache writes as well as input/output usage; its meter-derived estimate is $0.000944925, while the UI deliberately displays a conservative $0.0018595. See the complete raw usage in the Luna record. Compare it with Azure usage/cost records when available; no settled invoice cost is currently available.

## Next decisions and activation work

1. Review PR #46; leave it unmerged until reviewed. Two approved investigations are complete and both failures are recorded. The explicit tool interface has been simplified to separate model choices from deterministic metadata. Before another real call, approve one further investigation and a cumulative ceiling sufficient for its requests: two additional $0.31 reservations would take the preserved total from $0.62 to **$1.24**, so the current $1 ceiling is insufficient. No increase or further call has been made.
2. Reuse the private persistent local Redis configuration and securely read the existing Foundry credentials. Restore the same ledger, verify its counters, and run only the approved explicit action. Keep legacy/proactive AI and historical/recorded access disabled. Existing workflow, HTTP, token, timeout and concurrency limits remain in force. Local-only certificate/key material and credential files are never committed.
3. Require actual valid evidence-tool execution, competing interpretations, counter-evidence handling, stopping and independent publication verification. Compare with unchanged B2 and retain every result, including failures. Do not claim added value from a different selection alone. Stop when the approved investigation count is reached, even if money remains.
4. Only consider the proposed **new $10 testing campaign** if the owner approves it after reviewing the first results. Any increase must preserve cumulative spending and existing historical totals. A Redis outage or exhausted ledger remains deterministic fallback; Azure monitoring is not the gate.
5. Public activation needs a reviewed PR, successful live validation and an approved durable accounting arrangement accessible to App Service. The deferred Azure estimate above is one checked option; it is not needed for the next local model test. Do not expose a laptop's Redis to the public app or substitute disposable process memory.
6. For an approved public release, keep `AI_ENABLED=false`, `FOUNDRY_ENABLED=false`, `AI_PROACTIVE_ENABLED=false`, `HISTORICAL_MATCHES_ENABLED=false`, `RECORDED_MATCHES_VISIBLE=false`. Set `AI_INVESTIGATOR_ENABLED=true`, the approved rate card, a TLS `AI_REDIS_URL`, and explicitly approved workflow/attempt limits only after durable accounting is in place. Reuse the current Foundry deployment unchanged. Existing public limits are zero; never silently consume historical allowances.
7. Release through the existing [Azure deployment procedure](../DEPLOYMENT.md), with an immutable release manifest. Verify signed-out desktop/mobile, synthetic-only access, no automatic inference and deterministic fallback. Keep the current release and [rollback procedure](../release-2026-10-12/RELEASE.md#rollback). The hackathon video, submission and historical evaluation/release records remain unchanged.

## Validation and limitations

- PR #45 reviewed at `699e9663f219965c2fe138987abc569d67032013`; all four GitHub checks passed and there were no blocking findings or review comments. Squash merged as `1a021b110153cfd83988d6dbdc4526f06760966e`. Local `main` fast-forwarded to that `origin/main`; this change uses a separate worktree. Original local commit, modified `next-env.d.ts`, `.DS_Store`, other worktrees and artifacts remain intact.
- Type checking, production build, 865 unit tests (8 optional skips), and all 210 enabled production browser checks across desktop/360px/390px passed (42 historical-access skips). The route integration test uses an explicitly mocked transport; it is **not** a real model evaluation.
- Real local Redis 7.4 verifies simultaneous reservations, single workflow ownership, the $10 ceiling, permanent counters across connections and rejection of missing/expired/corrupt accounting. That disposable local container is not proposed as production storage.
- Cloudflare build, deployment dry-run and all three focused desktop/mobile browser checks passed without deployment.
- Browser checks hit the actual application endpoint with AI disabled, verify no automatic POST, deterministic fallback, evidence disclosure and receipt download. Local desktop/mobile captures were visually inspected. Existing mock-based browser tests remain labeled safety/regression coverage.
- All historical evaluation files, source manifests, B2 implementation and independent verifier are unchanged. Historical freeze tests now explicitly expect the old live candidate to reject this new application source; no manifest or authorization was refreshed.
- **Real Foundry calls: 2 authenticated HTTP 200 responses; completed model-selected retrievals: 0.** Both selections were rejected; B2 fallback was shown. Added AI value is not established. See the separate [Mini](first-real-investigation/README.md) and [Luna](luna-real-investigation/README.md) records. The earlier `validation.json` remains the pre-inference snapshot, not the current call total.
