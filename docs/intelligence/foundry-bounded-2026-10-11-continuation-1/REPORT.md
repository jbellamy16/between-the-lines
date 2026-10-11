# Bounded Foundry continuation — October 11, 2026

**Executed and stopped under the authorized failure rule. Technical acceptance failed; useful completed AI contribution was not demonstrated.** Draft [PR #25](https://github.com/jbellamy16/second-look/pull/25) contains the actual receipts and a subsequent offline fix. Nothing was merged or deployed.

The exact live-evaluated commit is **`461a27d95fb6afebade70a524f8de85d1334f388`**, Director **1.4.0**. Director **1.4.1**, commit **`f3fd44154c0dbcd915ac5bd938d90cd855f06299`**, is a later offline fix and has **not** received a live evaluation. The [manifest](manifest.json) freezes source/prompt/fixture hashes, deployment, prices, configuration and the parent receipt hashes. The previous [blocked preparation](../foundry-bounded-2026-10-11/REPORT.md) remains byte-for-byte unchanged and contributed zero attempts/spending. This is the single linked continuation, not a replacement ledger.

## Actual outcomes

All cases were declared in current **analyst** investigation mode, neutral preferences, in this order. The campaign stopped after the first runtime failure; no failed case was rerun or replaced.

| Case               | Cutoff | Outcome       | HTTP attempts | Actual result                                                                                                                      |
| ------------------ | ------ | ------------- | ------------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| misleading-quality | 30:00  | Failed        |             1 | HTTP 200 returned a valid counter-evidence query; local capacity blocked its follow-up. Verified deterministic fallback displayed. |
| pressure-fan       | 63:24  | Not attempted |             0 | Stop rule; historical name does not change analyst mode.                                                                           |
| temporal-weakening | 70:00  | Not attempted |             0 | Stop rule.                                                                                                                         |
| temporal-resolved  | 75:00  | Not attempted |             0 | Stop rule. Offline eligibility was no-call, but no live abstention occurred.                                                       |
| unfamiliar-8911    | 70:00  | Not attempted |             0 | Stop rule.                                                                                                                         |
| unfamiliar-73129   | 70:00  | Not attempted |             0 | Stop rule.                                                                                                                         |

**Counts: 0 completed, 1 failed, 0 abstained, 5 not attempted.** One workflow began. The only response was HTTP **200**, Responses status **completed**; this was a function-call response, not a completed editorial result. The ledger contains no final model plan or selected model claims. There were no retries, 429s, unknown-usage reservations or cancellation leaks. No later workflow started, so the 65-second inter-workflow spacing was not exercised live; it remains enforced and tested.

## Attempts, cost and controls

The [append-only ledger](ledger.jsonl), [original runtime result](case-misleading-quality.json) and [aggregate results](results.json) preserve the failure. [Execution hashes](execution-receipt-hashes.json) were saved before diagnosis or product edits.

- **1 actual provider HTTP attempt**, 2,003 input tokens, **0 cached input**, 66 output tokens; total 2,069 tokens.
- A **$0.308100** full-context reservation was durably written before dispatch. Valid usage settled it to **US$0.00179925** conservative accounting, also the reported-rate estimate because no input was cached. No outstanding unknown reserve remains. The $0.50 ceiling was never approached or weakened.
- Transport latency: **1,798 ms**. Runtime workflow latency: **1,842 ms**. The application declined a required **58,179 ms** capacity wait because it could not fit inside the unchanged 55-second workflow deadline with an 18-second transport allowance.
- Tool invocations: **2** — the required initial `get_match_events`, then the model-chosen `inspect_counter_evidence` for Harbor, `(0,1800]`, anchored at `live-challenge-misleading-quality:4`, with no player filter. The second HTTP request was never dispatched or charged as an attempt.
- Durable application workflow and attempt totals both equal **1**, matching the study ledger. Process limits were 2/minute, 12/hour/day/total, 10 requests/minute and 10,000 tokens/minute. The independent ledger retained six workflows, twelve attempts, three attempts/workflow and $0.50.

The refreshed [preflight](preflight.json) confirmed GPT-5.4-mini `2026-03-17`, deployment `between-the-lines-gpt54-mini`, GlobalStandard West US 3, unchanged capacity 10, 10 RPM/10,000 TPM. Microsoft retail meters remained $0.75/M input, $0.075/M cached input, $4.50/M output. These are token-rate estimates, not an invoice. The reservation still covers the entire documented 400,000-token context plus 1,800 output tokens. The application throughput estimate is a separate safeguard, not billed usage.

The dedicated Redis store used localhost port 16379, AOF and synchronous fsync, no eviction, a retained named volume and a permanent manifest-bound execution claim. Initialization refused existing/nonempty state. Full counters and ownership survived restart before execution; charged counters and execution ownership survived another restart afterward. The [service shutdown receipt](service-shutdown.json) confirms the service is stopped and its volume retained. `.env.local`, hosted AI=false/zero quotas, and Azure capacity remained unchanged. Credentials were confined to process memory/environment and excluded from receipts, logs, browser output and Git.

## Assistant analysis of usefulness — not human preference evidence

The live tool choice addressed a meaningful uncertainty: Harbor's shot count rose **1 → 4**, while aggregate synthetic source xG fell **0.8 → 0.2**. Checking counter-evidence was appropriate and its window/anchor covered the relevant evidence. However, the model never received the tool result in a second request and never selected an editorial conclusion. We cannot credit it with a better story, a resolved uncertainty or an appropriately qualified final claim. More tool activity alone is not a benefit.

The actual fallback story and narrative exactly match the independently verified same-state deterministic baseline. They report the shot increase, retain the xG qualification, and distinguish the weakening five-minute storyline from the longer rolling comparison. Keeping that baseline was sensible. Those useful qualifications are supplied by application verification/rendering, not demonstrated model reasoning.

[Case-by-case assistant assessment](assistant-assessment.json) records every baseline and the limits of comparison. For the five unattempted cases, there is no actual model result or usefulness evidence. The temporal-resolved baseline would sensibly bypass inference for the 74:35 equalizer; it is still **not** counted as a live abstention. No human reviewer was contacted and no preference score was invented.

There are **zero accepted AI publications** to render. The original fallback equals the baseline that already passed prefix-only tool replay, complete hypothesis/story equality, timestamp/source/evidence alignment and qualification checks. Its four [local views](fallback-preview.html) show Plain English / Football Analysis × Quick / Full, generated from frozen receipt data without requests. [Browser checks](local-render-check.json) confirm four views, no overflow at desktop/mobile widths and zero external requests. Both styles and both lengths retain the lower-xG and weakening qualifications. A minor existing presentation issue remains: the shorter-window weakening caveat appears twice in differently worded bullets; the receipt preview preserves it rather than rewriting the observed output.

## Offline diagnosis and fix

The [before-fix reproduction](offline-diagnosis-before-fix.json) regenerated the first request with **exactly the live payload hash and 9,383 bytes**. A scripted response containing the saved tool query reproduced capacity failure: estimated reservations **5,184 + 7,517 = 12,701** exceeded 10,000 TPM. Provider response IDs were reconstructed; private reasoning was not retained or replayed.

The subsequent Director **1.4.1** fix shortens repeated instructions/tool descriptions, projects counter-evidence as compact rows, and avoids resending already-seen events simply to add coordinates irrelevant to this query. Every measurement (including labels/units/windows), supporting/limiting/contrary evidence item, missing-information warning and check verdict retains its event references. Complete check explanations, source capabilities and display/watch-next material remain in canonical server assessments; independent verification and final story rendering are unchanged. A cache-version bump prevents reuse of older investigations.

The runtime now requests a final editorial decision when its own minute reservations show that another optional investigation plus a subsequent final request cannot fit. It uses the unchanged conservative payload estimator and provider TPM ceiling. This does not increase any request, tool, output, timeout, rate or spending limit; shared application controls still make the actual admission decision.

The [after-fix regression](offline-regression-after-fix.json), with realistic-length reconstructed provider IDs and a **scripted** final plan, completes two requests with reservations **4,372 + 5,303 = 9,675**, applying the actual 6-second shared pacing. Fresh verification preserves the original xG counter-evidence in the final story and both styles/lengths. This proves the reproduced path fits; it is **not** another paid campaign, a model-selection result, or evidence of general reliability. Larger histories, additional tool choices, retries or concurrent demand can still exceed the fixed allocation.

## Validation and release recommendation

Before execution: type check, production build, **492 passing / 1 intentionally skipped tests**, including real isolated Redis restart/exhaustion/corruption coverage. After the offline fix: type check, production build, **494 passing / 1 intentionally skipped tests**. Ledger tests cover unknown usage, retries, spending, deadlines and cancellation. Projection regressions compare every retained counter-evidence value and reference with canonical assessments. Required GitHub verify/Cloudflare checks are linked on the existing PR; current-head results are recorded in the PR description after completion.

Keep PR #25 draft and public inference disabled. Review the offline capacity fix, then obtain separate authorization for any new bounded live campaign; this continuation is consumed. A further live study and human football relevance review are needed before claiming useful AI contribution or production readiness. Release the verified offline experience only through a separately approved merge/deployment. This task performed neither.
