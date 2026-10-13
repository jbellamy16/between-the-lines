# First real GPT-6 Luna investigation

**Authenticated model response; rejected investigation. No successful AI investigation or advantage over B2 demonstrated.** The owner deployed `between-the-lines-gpt-6-luna-1` and explicitly approved one Luna investigation within the original $1 cumulative ceiling. The agent made no deployment changes and bought no cloud services.

## Observed behavior

The signed-out local production UI ran pressure/demo at **60:00** with `reasoning.effort=low`. It made one HTTP request, completed in **2.102 seconds** at the provider and **2.268 seconds** in the app. The 70:00 and 63:24 packets were too large for two requests under the existing conservative 30,000-TPM guard; offline serialization sizing selected 60:00, with room for follow-up retrieval. No guard was raised. These different conditions do **not** support a controlled Mini-versus-Luna quality comparison.

Luna selected the canonical **inspect_counter_evidence** option for **Harbor: more attacking-third actions**. Its option and focal IDs were valid. It also returned the wrong redundant purpose (`resolve-priority`) and an unregistered interpretation (`repeated-route`). The unchanged validator rejected this combination before executing the tool. There was no completed model-selected retrieval, model stop, or verified final model result. The app retained the existing B2 recovery-to-shot explanation.

An offline diagnostic confirmed that the selected option/focal pair is valid when code supplies its canonical routing metadata. That diagnostic was not another model call and did not execute a repaired decision or claim a successful investigation.

## Usage and money

The provider reported **7,072 input tokens**, including **7,069 cache-write tokens** and zero cache-read tokens, plus **122 output tokens** and zero reasoning tokens. At Microsoft's published Global Standard short-context rates, the estimate is **$0.000944925**: `(3 × $0.10 + 7069 × $0.125 + 122 × $0.50) / 1,000,000`. The application deliberately displayed the larger **$0.0018595** conservative estimate using long-context cache-write and output rates. Neither is a settled Azure invoice.

Both real calls combined are estimated at **$0.011098425**. Each reserved $0.31 without refund, so the same non-expiring ledger now holds **$0.62** against the unchanged **$1** ceiling, with two lifetime HTTP attempts and two workflows. The original Mini rate card and counters were preserved; only the explicitly approved additional Luna rate card and approval were appended. Counters survived a Redis restart. Local inference and Redis are stopped, with persistent data retained privately.

See [pricing and worst-case reservation](pricing.json), [actual deployment](azure-readiness.json), [summary](summary.json), [approval](approval.json), [request](request-1.json), [provider response](response-1.json), [application receipt](application-receipt.json), and [restarted ledger](ledger-final-restarted.json). Credentials and request headers are excluded.

## Implementation correction and remaining work

The explicit retrieval interface now asks the model for only **optionId and focalId**. The server binds canonical index/purpose values and uses an empty interpretation list for retrieval; the model selects final interpretations in its final plan. This removes redundant copying from the model's task. Unknown selections and extra arguments are rejected. The existing independent validator still checks focal/option compatibility, duplicate or unavailable evidence, canonical replay, mandatory challenges and final publication. Its source is unchanged. Receipts explicitly attribute model choices and deterministic bindings separately. Evaluation mode retains its previous read interface; no historical record or allowance is refreshed.

This is prompt/contract version **investigator-selection-1.0.2**. It has not had a paid model test. Regression checks establish code behavior only; they do not establish model intelligence. A successful end-to-end live investigation remains the next acceptance criterion. Public activation stays off and PR #46 stays unmerged.

Both one-investigation approvals have been consumed. A two-request follow-up would require a cumulative reservation of **$1.24**, exceeding the original $1 cap; it therefore needs explicit owner approval of an increased cumulative ceiling, preserving the existing $0.62. No increase has been made. No further model call was made after this failed investigation.
