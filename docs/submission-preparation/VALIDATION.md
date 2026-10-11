# Submission preparation — validation and limits

Checked October 11, 2026, America/Chicago. Application source: merge `fb108863dae6a69a7af0df0101ca1fbc66ab4be1`; Director `1.4.0`. This preparation changes documentation and evidence files only.

## PR #23 review and merge

Reviewed exact head `f1c938f70f876f57bd8e2834c2f709909951b7c2`, its full product diff, associated regression cases, comments/reviews, mergeability and checks. No comments/reviews or blocking defect were found. No branch protection or repository ruleset applied; no bypass was used. Existing repository history uses merge commits. Marked ready and merged with an exact-head guard on October 11 at 15:38:19 UTC (10:38:19 Chicago), then fast-forwarded local main and created `codex/hackathon-submission-demo`. Existing clean explanation-styles worktree preserved.

The style preference changes local presentation and stays outside match selection, playback, preferences used for investigation, request bodies and cache identity. Primary qualifications survive both styles; independent Quick/Full remains intact. Regression coverage checks selected observations, event replay, favorites, in-flight/cached reviews, unknown counter-evidence, source precision, dense passing samples and rewind. No product fix was necessary. **This assistant review is not human wording validation.**

- [PR #23 CI](https://github.com/jbellamy16/second-look/actions/runs/38151215708): both verification jobs passed at the reviewed head. PR report records 465 unit passes / one optional skip, 216 production browser passes, 171 Cloudflare browser passes / 45 hidden-source skips.
- Fresh local `AI_ENABLED=false npm run check`: **463 unit passes, three conditional skips**, typecheck and production build passed. Two Redis cases require the CI service; one StatsBomb fixture is optional.
- Fresh focused production-browser checks, `explanation.spec.ts` and `recap-briefing.spec.ts`, desktop: **12 passed, two recorded-source skips**. Recorded fixtures were hidden locally. No failed test or retry.
- No deployment workflow was triggered. The deployment workflow is manual; normal push/PR CI is authorized.

## Current local demo

Built and started from updated main using [submission setup](../SUBMISSION.md#judge-setup-and-walkthrough), with AI, legacy Foundry and proactive flags false, provider offline, runtime quotas zero, historical sources disabled at build/runtime, host 127.0.0.1:3124. Local Node was 26.8.2 (supported range); CI verifies the documented Node 24 target and fresh `npm ci`. Existing `.env.local` was neither printed nor overwritten.

Verified in the actual local browser: synthetic source and 1–0 score at 63:24; Catch Me Up's full-match scope; Quick/Full; both explanation styles; exact comparison windows and four shot references; six-action 58:39→59:09 possession replay; unchanged main cutoff during replay; and the 70:00 primary weakening qualification. The separate five-minute recovery disclosure was also inspected, and exact keyboard staging to 4200 seconds was exercised. No mock provider response was injected into the demo.

[Machine-readable checkpoints](checkpoints.json) were regenerated with the current source's observer, story packaging, style renderer, briefing score and storyline reconstruction. They include canonical replay events and their source IDs. [Six screenshots](../intelligence/DEMO.md#current-screenshots-and-rehearsal) were captured and visually inspected; final dimensions are 1920×1080. These are local Chromium captures, not deployed-version, physical-device or human usability evidence.

## Timing rehearsal

The [216-word narration](../intelligence/DEMO.md#timed-narration-and-exact-actions) targets 114 seconds, about 114 words/minute including pauses. The final browser rehearsal ended at **114.001 seconds**. Replay dispatch was 3.680 seconds late due to the automation handoff, but all six actions completed by the 69-second verification cue. The later scene started at 76.002 seconds; the Foundry explanation hold began at 91.001 seconds. Earlier attempts with inconsistent viewport dimensions and delayed cues are retained in [rehearsal.json](rehearsal.json), not described as flawless takes.

This was an interaction rehearsal with silent narration holds. **No voice track or final video was recorded.** An actual read-aloud take, caption proofread and exported-duration check remain required; do not claim a completed submission video. The staged 70:00 tab avoids exact scrubbing during the take. The current local app, not a historical response preview, is the software shown.

## Public hosts and portal

[Saved read-only public observations](public-status.json): Azure homepage/status returned 200; status reported offline and proactive false. Its HTML did not contain the new style labels and the endpoints did not expose a deployed commit. Current source parity is not established. Cloudflare status returned offline to curl; a subsequent Python client got 403 on both routes, so access is client-dependent and judge readiness unverified. No public POST/inference calls were made. No Azure configuration was read or changed in this preparation.

The official entry redirect reached Innovation Studio, which required owner authentication. We could not inspect the authenticated Projects form, establish registration or accept any entry terms. Rules dates and requirements were read from the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md); the [submission checklist](../SUBMISSION.md#release-checklist-and-owner-actions) retains the portal check as an owner action.

## Evidence boundaries

- Current implementation: automated offline/scripted provider tests and actual local interactions, as above.
- Historical live Foundry: Director 1.2.0 / `22fb005`, October 10 Chicago, 14 publications / four failures / one no-call state. [Original receipts](../intelligence/pr18-intelligence-2026-10-10/REPORT.md) remain unchanged. Earlier 1.0.2 and 1.1.2 studies retain their own scope.
- Current live evaluation: [six-case proposal](../intelligence/foundry-efficiency-2026-10-11/REPORT.md#current-submission-evaluation-addendum) only. Six workflows, twelve attempts, US$0.50 maximum reserved spend; no authorization or execution.
- Human feedback: none received or fabricated. Current wording checklist and older blinded forms remain separate; no reviewer outreach.
- Delivery: subsequent draft PR stays unmerged. Deployment, AI enablement, recording/publication and competition submission require separate owner action.

All 101 relative documentation links/anchors across ten Markdown files passed validation. Cited rules/portal redirect, exact fixture checkpoints, JSON readability, image dimensions and whitespace were checked. The final demo and weakening tabs reported zero browser errors. Repository CI status is available on that PR; do not infer a deployment from a green verification job.
