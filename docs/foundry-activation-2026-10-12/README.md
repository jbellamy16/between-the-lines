# Explicit Microsoft Foundry investigation: application integration

Prepared October 12, 2026 (America/Chicago). **Review candidate; not deployed. Real inference remains disabled. No new model calls or model behavior claims.** The owner’s willingness to test is recorded, but the proposed $10 allowance and new billable infrastructure still need explicit approval.

## Implemented

The synthetic match story has an **Investigate with Microsoft Foundry** button. A click sends only the selected canonical scenario/profile and exact timestamp to `/api/investigate`. The server reconstructs the source, supplies verified B2 evidence, and connects to the existing bounded investigator from PRs #37–43. Historical IDs, arbitrary evidence, model names, automatic actions, and cross-origin browser calls are rejected. Neither page loading nor playback, navigation, explanation-level changes or ordinary guided questions starts this workflow.

The existing model loop can select registered evidence options, execute their bounded tools, revise the focal interpretation after retrieval, examine competing explanations and challenges, and propose a stop. The unchanged independent verifier replays canonical evidence before publication, including cache hits. All B2 calculations, mandatory counter-evidence and qualifications remain available. A model choosing no optional tool is reported as such; it is not credited with adaptive investigation. Forced final requests are labeled application stops rather than voluntary model decisions.

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

## Smallest reliable accounting service proposed

This workload needs a tiny durable database, not a high-throughput cache: one active investigator, at most 30 provider attempts in the initial proposal, atomic Lua reservations, TLS, no eviction, non-expiring accounting, and acknowledged writes persisted before inference. Unavailability is acceptable because the application falls back; losing acknowledged spending is not.

**Propose one non-Spot Linux ARM64 `Standard_B2pts_v2` VM (2 vCPU, 1 GiB), West US 3, with Redis, a 32 GiB S4 LRS managed OS/data disk, and one Standard IPv4 address.** The SKU inventory reports no subscription restriction for this size. B1s is restricted in both West US 3 and East US; it is not a deployable recommendation here. The usage/quota listing returned no entries, so allocation and family quota must be rechecked before any paid creation; SKU listing is not a capacity guarantee.

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

Proposed owner authorization: **approximately $11/month, up to a $12/month estimated run rate before tax**, no upgrades or extra services without approval. This is an estimate, not an Azure hard billing cap; disk operations/egress are usage-based. Redis pauses or inference gating do not stop VM/disk/IP billing. Do not add monitoring tiers, backup services, paid TLS products or another App Service tier under this approval.

Existing Foundry Global Standard Mini meters: **$0.75/M uncached input tokens, $0.075/M cached input tokens, $4.50/M output tokens**. A 10,000-input/1,000-output request would be about **$0.012**, not an observed cost. Azure lists a 400,000-token context and 272,000-token input limit for this model; the spending reservation deliberately overestimates using the entire context as input. [Azure model specification](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-54).

## Enforced initial $10 testing ceiling

The new ledger is `{second-look-ai}:explicit-investigation:usd:v1`. It is separate from all historical study keys, which remain untouched. No ledger has been initialized by this task.

Each provider attempt, including retries and failed/ambiguous calls, must first acquire an atomic **$0.31 nonrefundable reservation**. This exceeds `400,000 × $0.75/M + 1,800 × $4.50/M = $0.3081`. Thus the cap does not depend on the existing approximate token-pacing heuristic, on successful responses, or on Azure monitoring. A $10 ledger admits at most 32 such reservations ($9.92); the proposed lower total-attempt allowance of 30 limits the pilot further to $9.30 reserved. Actual model charges should normally be much lower; unused reservations are not refunded or reused. Tax and unrelated Azure resources are outside the model-token ceiling.

The Lua gate rejects missing, expired, unapproved, malformed or inconsistent ledgers, the wrong rate card, amounts above $10, and an expired/wrong concurrency lease. It never creates a budget automatically. Redis failure denies dispatch. A 70-second shared lease permits one explicit workflow across instances; every attempt rechecks ownership and remaining transport time. Existing 55-second workflow deadline, 18-second in-workflow transport allowance, 1,800 output-token limit, 131,072-byte request limit, 30 RPM/30,000 TPM ceilings, three HTTP attempts (including retries), two adaptive rounds, four-tool ceiling, canonical checks and existing workflow/request quotas remain in force.

Token usage reported by the provider is captured separately from reservations. Missing or retried usage is incomplete; the receipt never invents a bill. The displayed retail cost estimate deliberately omits cache discounts and is not an invoice. Compare receipts with Azure usage/cost records after the approved pilot; no settled cost is currently available.

## Exact activation work after approval

1. Review this PR. Approve the infrastructure above and **a new, one-time $10 model-testing allowance**. Neither historical approvals nor the initial expression of willingness initializes this allowance.
2. Recheck VM SKU/family quota and rates. Provision only the approved Redis host, validate TLS/no-eviction/AOF-always/restart behavior and global atomic reservations using nonbillable test keys. Do not alter the Foundry deployment. Configure an operator-owned TLS secret; do not use memory accounting.
3. With inference still off, have the approved operator create the new dollar hash **only if it does not already exist**, atomically: `status=approved`, `rateCard=gpt-5.4-mini-2026-03-17-global-2026-10-12`, `ceilingMicros=10000000`, `reservedMicros=0`, `attempts=0`, no TTL. Record approval identity and pre/post values outside the app. If the key exists, inspect and preserve it; never reset it. This is a fresh proposed production allowance, not an extension of an evaluation budget.
4. Keep `AI_ENABLED=false`, `FOUNDRY_ENABLED=false`, `AI_PROACTIVE_ENABLED=false`, `HISTORICAL_MATCHES_ENABLED=false`, `RECORDED_MATCHES_VISIBLE=false`. Set the existing request ceilings to at most 30 RPM / 30,000 TPM. Proposed workflow minute/hour/day ceilings are **4 / 12 / 24**, with at most **30 additional lifetime HTTP attempts and 10 initial user investigations**. If the existing lifetime counters are nonzero, inspect and retain them and obtain additive absolute limits; never zero them or silently consume an old remaining allowance. Stop manually after 10 user investigations even if another limit leaves capacity. The global dollar gate remains the final hard ceiling.
5. Set `AI_INVESTIGATOR_RATE_CARD=gpt-5.4-mini-2026-03-17-global-2026-10-12` and the TLS Redis URL in a **controlled local production build first**. Reuse existing Foundry credentials securely. Enable `AI_INVESTIGATOR_ENABLED=true` only there for the approved pilot. Do not enable the public application yet.
6. Through the actual UI/API, request the synthetic pressure match at **63:24 and 70:00**, then substitution/quiet controls as capacity permits. Save every downloadable receipt separately from historical records. Check authenticated responses, selected option IDs and actual executed tools, comparisons/challenges, voluntary versus forced stopping, canonical verification, B2 selection/output, complete versus missing usage, reservations, observed latency and price-derived costs. Stop on unexpected metering or verification behavior. A model selecting no follow-up or providing no improvement is a valid negative finding, not grounds to fabricate agentic value or expand the campaign.
7. Exercise disabled, exhausted-budget, unavailable-Redis and failed/rejected-result fallback without resetting the production ledger (use isolated nonbillable safety tests where fault injection is needed). Reconcile real receipts and counters before considering public activation.
8. Only after successful live validation and PR review, release through the existing [Azure deployment procedure](../DEPLOYMENT.md), with a new immutable release manifest. Verify signed-out desktop/mobile, synthetic-only access, no automatic POSTs during navigation/playback, new explicit receipts and deterministic fallback. Keep the current release package and [rollback procedure](../release-2026-10-12/RELEASE.md#rollback). Turning the explicit flag off immediately restores deterministic behavior; a binary rollback is separate. The hackathon video, submission and historical release documentation are unchanged.

## Validation and limitations

- PR #45 reviewed at `699e9663f219965c2fe138987abc569d67032013`; all four GitHub checks passed and there were no blocking findings or review comments. Squash merged as `1a021b110153cfd83988d6dbdc4526f06760966e`. Local `main` fast-forwarded to that `origin/main`; this change uses a separate worktree. Original local commit, modified `next-env.d.ts`, `.DS_Store`, other worktrees and artifacts remain intact.
- Type checking, production build, 865 unit tests (8 optional skips), and all 210 enabled production browser checks across desktop/360px/390px passed (42 historical-access skips). The route integration test uses an explicitly mocked transport; it is **not** a real model evaluation.
- Real local Redis 7.4 verifies simultaneous reservations, single workflow ownership, the $10 ceiling, permanent counters across connections and rejection of missing/expired/corrupt accounting. That disposable local container is not proposed as production storage.
- Cloudflare build, deployment dry-run and all three focused desktop/mobile browser checks passed without deployment.
- Browser checks hit the actual application endpoint with AI disabled, verify no automatic POST, deterministic fallback, evidence disclosure and receipt download. Local desktop/mobile captures were visually inspected. Existing mock-based browser tests remain labeled safety/regression coverage.
- All historical evaluation files, source manifests, B2 implementation and independent verifier are unchanged. Historical freeze tests now explicitly expect the old live candidate to reject this new application source; no manifest or authorization was refreshed.
- **Real Foundry calls in this task: 0. Real model-selected evidence: none. Actual model cost/latency and added AI value: not measured.** Live activation is blocked by infrastructure/spending approval and subsequent verification. Public signed-out behavior of the new feature cannot be claimed until an approved release exists.
