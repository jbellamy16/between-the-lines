# First real Foundry application investigation

**A real authenticated call succeeded; the investigation did not pass verification.** This is a negative result, not an AI success demonstration. The signed-out local production UI used the existing GPT-5.4 Mini deployment at the owner-approved $1 ceiling. No new cloud service was purchased. Both local inference and its Redis container were stopped afterward; durable accounting is retained privately.

At pressure/demo **70:00**, one button click sent one model request. Page loading and seeking sent no POST. Foundry completed in **2.070 seconds**; the application returned in **2.450 seconds**. Reported usage was **12,842 uncached input + 116 output tokens**, including zero reasoning tokens. Applying the saved Azure retail rates yields **$0.0101535** before tax; the settled Azure invoice cost is not yet available. The app reserved **$0.31**, without refund, against the approved **$1** ceiling. One workflow/one request and the dollar reservation survived a Redis restart.

## What the model actually did

It chose `select_evidence_option` for **Visible score and source context** (`get_match_context`), associated it with **Harbor: passing passage ends in a shot**, and named `repeated-route` and `concentrated-attempts` as competing interpretations. This records an attempted selection; the evidence tool never executed.

Its `indexId` mixed the catalogue version with a truncated index hash. The unchanged validator rejected it. A subsequent **offline diagnostic only** showed that substituting the correct index still fails: those interpretations are not registered for the selected passing/shot story. No repaired decision was executed, published, or attributed to the model.

There was no completed model-directed retrieval, counter-evidence investigation, voluntary stopping decision or verified model conclusion. The UI published deterministic B2: Harbor's shots rose from 1 to 4, but the recent window slowed from 3 shots in its first half to 1 in its second. That counter-evidence and conclusion were already calculated by B2. **Additional AI value is not established.**

## Evidence and follow-up

- [Summary](summary.json), [owner approval](approval.json), [actual synthetic-only request body](request-1.json), [actual provider response](response-1.json), [application receipt](application-receipt.json).
- [Before click](ui-before.json), [after click](ui-after.json), [initial ledger](ledger-before.json), [pre-call restart](ledger-after-restart.json), [post-call ledger](ledger-after-call.json), [post-call restart](ledger-final-restarted.json). No credentials or request headers are included.
- Desktop and 390px mobile screenshots were captured privately. This establishes the local signed-out fallback experience; it does not establish a public deployment or successful live model result.
- Candidate commit: `074c589d7133d39899c9c13c5a604d78c26737c1`. Original receipt retained unchanged, including its misleading `toolInvocations=2` count (one initial packet plus one rejected call). Its empty trace correctly shows zero executed model-selected retrievals.

The follow-up change constrains the outbound tool and final-result schemas to the exact canonical index, provides that index literally outside the compressed evidence tables, clarifies that interpretations belong to the chosen story, and counts only completed retrievals. The independent validator is unchanged. A regression replay checks the malformed-ID failure without making another paid call. **The revised prompt has not been tested against Foundry yet.** Its focused 92 regression checks, full local suite (862 passed, 12 optional skips), typecheck and production build passed. The four local Redis integration checks were already run for the original PR and were not repeated against the paid ledger.

The existing 30,000-token-per-minute guard uses a conservative request estimate. Large packets can leave insufficient allowance for a follow-up inside the 55-second workflow. This run never reached that stage. Further testing must retain that guard and report any resulting fallback; it must not silently raise limits.

Next decision: authorize one follow-up investigation within the remaining original $1 ceiling, or stop here. This approval was for one investigation, so unused reservations are not treated as permission to run more. Public activation remains off pending a verified live result, PR review and a separately approved public accounting arrangement.
