# Foundry investigation efficiency and recovery

October 11, 2026. Baseline: `main` at `cd4b67d` (PR #21). Implementation: Director `1.4.0`. No live inference, AI enablement, Azure changes, deployment or merge was performed. The PR #18 evaluation receipts remain unchanged.

## Resulting behavior

The application performs the required unfiltered `get_match_events` retrieval over the complete review window before inference. It records that retrieval in the trace, registers exactly the same supported claims, and replays every successful query in a fresh verifier before publication. The model can publish immediately or investigate a material unanswered question. Score/quiet-spell preflight decisions, lead eligibility, restricted-source handling, counter-evidence assessment, cutoff safety and deterministic rendering remain enforced.

The initial packet contains claim details, exact measurements, limitations, support references and source provenance once. Short claim IDs resolve only through the server's conversation-local mapping and verified registry. Event identifiers use a reversible prefix dictionary; repeated actors/limitations use references. Initial event rows retain times, source precision, identities and action types; coordinates, outcomes and possession details remain available through follow-up retrieval. Those summaries do not replace the canonical events used by the independent verifier. Follow-ups upgrade summarized events when needed, omit already-sent unchanged records, and preserve complete counter-evidence assessments with referenced identifiers. One optional function dispatches the existing eight read-only queries through a shared argument schema.

The 1,800-token output allowance is unchanged. The Director retains a maximum of three HTTP attempts, now **including retries**, and four evidence queries, **including application retrieval**. It retains an 18-second transport timeout and 55-second investigation deadline. The shared workflow wrapper also bounds waiting/generation inside its 70-second lock lease; legacy narration receives the same overall deadline.

## Shared accounting and failures

Existing workflow allowances and the persistent `{second-look-ai}:budget` remain intact. Additional durable attempt counters use the existing hourly/day/total settings (default 30/60/100). Every dispatch consumes one attempt plus a conservative token reservation. Neither failures nor successful responses refund these reservations. Token counts for completed responses remain separate from estimated capacity reservations; unknown usage cannot become a zero-cost success.

Atomic Redis scripts coordinate all updated instances and providers:

- Sliding 60-second request and estimated-token totals, capped at 10 RPM and 10,000 TPM. `AI_REQUEST_MINUTE_LIMIT` and `AI_TOKEN_MINUTE_LIMIT` may lower these ceilings.
- Minimum dispatch spacing of `ceil(60000 / RPM)` milliseconds, including between different workflows.
- Shared provider cooldowns, extended rather than shortened by later 429s.
- Existing workflow locks/cache, plus cancellation-aware in-process coalescing. Each subscriber can leave independently; the last subscriber cancels transport. Success and failure cannot leave permanent loading states or locks.

These are application ceilings derived from historical observations, not verification of current Azure allocation. [Microsoft documents estimated prompt/output rate accounting, short-window request throttling and retry headers](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/quota). The application uses server time inside Redis and never resets existing counters. Redis persistence/no-eviction and one shared store remain operational requirements.

Only an explicit 429 is eligible for automatic recovery: at most one retry per provider operation, with every attempt included in the three-attempt investigation ceiling. The largest valid `retry-after-ms`, `x-ms-retry-after-ms` or `Retry-After` delay is respected, with a small positive jitter and a shared cooldown. The retry must also fit pacing, tokens, durable allowance and the remaining full transport time. Billing-quota errors do not retry. Transport ambiguity, timeout, 5xx, malformed/incomplete responses and failed verification do not automatically replay a potentially billable request.

Responses carry only safe failure categories, HTTP status internally and numeric retry guidance. Raw provider bodies, credentials, endpoints and private reasoning are never returned to the browser. When recovery is unavailable, the verified deterministic story remains visible with an accurate reason and an available manual retry action.

## Cache correctness

The server caches verified successes only. Its key includes the full canonical evidence digest, cutoff, mode/preferences, provider, model, endpoint and implementation version. Failure locks have a five-second cooldown; an interrupted store/process leaves at most the existing 70-second lease.

The browser distinguishes completed reviews (including intentionally offline reviews) from failure fallbacks. Failures and cancelled requests are evicted; successful results remain reusable. Match object identity separates immutable canonical source revisions, and keys include exact cutoff, mode, sorted preferences/seen evidence and implementation version. Before an action reuses a result, a no-inference configuration request refreshes an opaque fingerprint covering provider/model/endpoint/version and control readiness. A model change in an open tab cannot reuse an older model's cached result. Concurrent reviews share one POST; closing one view does not cancel another subscriber's work. The story action and recap use the same request/cache path. Failed episodes are removed from proactive deduplication while retaining its existing 60-second throttle; a later playback action can retry the same episode without creating a request loop.

## Offline before/after measurements

These are **scripted transport measurements, not live provider results, token usage, latency or quality scores**. Seven representative saved cases were replayed against the PR #21 investigator and this investigator with the same valid selection. The old required tool call was returned by the script; the new script selects from the application-retrieved claims. Optional follow-ups/retries are not included in this one-selection comparison. Application preflight can still skip inference for a score/quiet context; these measurements deliberately compare the investigator itself on both versions.

The reviewer export omitted per-event synthetic source wrappers. The measurement test restores only the adapter's known second-precision synthetic identity/coordinate metadata **in memory**, using saved event fields. It never alters the historical export. The selected canonical claims and independent verification agree before and after.

Each token estimate is `ceil(serialized UTF-8 request bytes / 3) + 256 framing + 1800 output`. This heuristic exceeds recorded input usage on every historical successful HTTP response with usage, but is not a tokenizer, a guaranteed provider rate estimate or a billing calculation. Output allowance is counted on **every** request.

| Saved case         | HTTP requests | Total request bytes            | Total estimated tokens, including output |
| ------------------ | ------------- | ------------------------------ | ---------------------------------------- |
| misleading-quality | 2 → 1         | 27,845 → 9,365                 | 13,394 → 5,178                           |
| pressure-fan       | 2 → 1         | 63,597 → 18,084                | 25,312 → 8,084                           |
| pressure-analyst   | 2 → 1         | 63,611 → 18,094                | 25,316 → 8,088                           |
| temporal-weakening | 2 → 1         | 70,372 → 20,220                | 27,570 → 8,796                           |
| temporal-resolved  | 2 → 1         | 71,266 → 20,432                | 27,868 → 8,867                           |
| unfamiliar-8911    | 2 → 1         | 89,336 → 22,338                | 33,891 → 9,502                           |
| unfamiliar-73129   | 2 → 1         | 63,383 → 18,024                | 25,240 → 8,064                           |
| **Total**          | **14 → 7**    | **449,410 → 126,557 (−71.8%)** | **178,591 → 56,579 (−68.3%)**            |

All seven first requests fit the 10,000-token application ceiling under the heuristic. [Machine-readable measurements](measurements.json) include per-request sizes, selected canonical claims, baseline reference and method. Reproduce without inference using:

```sh
AI_ENABLED=false FOUNDRY_CAPTURE_BASELINE=1 npx vitest run tests/foundry-efficiency.test.ts
```

Baseline capture requires commit `cd4b67d` locally. It creates and removes temporary baseline modules and writes only `artifacts/foundry-efficiency.json`. Normal unit runs measure current behavior without requiring Git history. The opt-in measurement command still mocks all HTTP transport and capacity controls; independent reliability tests exercise the real control implementation with fake time and mocked HTTP.

## Validation

- `npm run check` with AI disabled: type checking, **453 tests passed**, three optional skips, production build passed. Local skips: two external Redis integration tests and the optional local StatsBomb fixture.
- Mocked HTTP plus real local accounting covers 429 header timing, shared cooldown, cancellation while waiting/in flight, workflow deadline/lease cleanup, concurrent pacing/token reservations, durable unknown-usage charges, no replay of ambiguous failures, exhausted allowance, incomplete responses, and same-context server/client recovery. A separate orchestration regression covers retry plus follow-up within the three-attempt ceiling and unknown-usage provenance.
- Evidence regressions retain exactly the retrieved claim set, reconstruct support/limitation references, compare statistics and detail text, confirm prefix invariance, and reject unregistered/future/unsupported claims. Existing hypothesis/counter-evidence, editorial eligibility and source-precision suites still pass.
- Two real-Redis integration tests run in repository CI against its isolated Redis service, including multiple clients, atomic token/request accounting, cooldown extension, corrupt-state rejection and preservation of existing workflow counters. No local Redis service was available for this implementation run.
- Production browser suite: **192 passed** across desktop, Android-sized and iPhone-sized Chromium views. After the final proactive-episode cleanup, **nine focused browser checks passed**, including three new same-context proactive recovery cases. Cloudflare build and deployment dry run passed; the Cloudflare browser suite passed **150**, with **42 recorded-match journeys skipped** because that build hides recorded matches. No deployment occurred. Repository CI repeats the full suites on the final code.
- Desktop/mobile screenshots were inspected for loading, the retained story/pitch during a mocked 429, visible retry actions and a recovered result. Recap checks cover failure recovery, successful reuse after reopening and cancellation on rewind. These are scripted UI states, not real provider outcomes. Physical Safari devices were not tested.

## Limits and a proposed separately approved live check

This change does not establish improved live completion rates or model editorial quality. The compact wire format needs a small real-provider check. The token estimate may differ from the provider's current admission estimate. Traffic outside this shared store (or from older releases) is not counted; provider 429 guidance still governs recovery. The counters are request/token safeguards, not a dollar billing meter.

A larger initial request can consume most of the minute's allowance. An optional follow-up or a second fully reserved attempt can then be impossible within the 55-second deadline. The application returns the checked fallback and permits a later same-context retry; it does not raise limits, shorten output allowance or claim the initial request was free. Even a successful mocked recovery does not imply those larger workflows can automatically retry at current capacity.

**Proposal only — not authorized or executed:** run six saved cases once: misleading-quality (1800), pressure-fan (3804), temporal-weakening (4200), temporal-resolved (4500), unfamiliar-8911 (4200), unfamiliar-73129 (4200). Use the existing deployment/model and current spending controls. Check source/prompt versions, deployment limits, applicable token prices and remaining application allowance first; stop if they cannot support the approved plan. Do not change Azure settings or reset counters.

Limit the entire study to **six workflows, twelve HTTP attempts and US$0.50 maximum conservatively reserved spend**, whichever is reached first. Keep the runtime's three-attempt per-workflow ceiling within that smaller study-wide attempt cap. Reserve a safe byte/token cost envelope before each attempt, retain unknown-usage reservations, and stop before any attempt that would exceed the money cap. Space cases at least 65 seconds after the preceding case finishes, while still obeying provider retry guidance and shared controls. Do not spend the historical study's unused allowance.

Record actual completion, incomplete output, selected claims, optional questions, attempts, 429 headers, input/output/cached usage and latency separately from estimates. Independently replay verification and inspect the event/claim alignment and counter-evidence. Accept no unsupported or future claim; report all failures, including preflight abstentions, without quietly substituting reruns. Store new receipts in a new directory. Human preference and broader deployment readiness remain outside this small check.
