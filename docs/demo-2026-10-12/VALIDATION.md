# Demonstration validation — October 12, 2026

**Later audit update:** The [readiness candidate](../readiness-2026-10-12/README.md) corrects the equal-quality verdict defect and passes the same offline conclusion-safety gate. The original recording/study findings below remain historical evidence; they have not been rewritten or reclassified. Public deployment parity and video publication are still pending.

This is assistant validation of selected software behavior and prepared media, not participant feedback, a new model evaluation or a release-readiness certification. Application code, historical study receipts and hosted settings are unchanged. No deployment, paid inference, submission or video publication occurred.

## Previous PR review and synchronization

Reviewed the full four-file diff of [PR #34](https://github.com/jbellamy16/second-look/pull/34), head `fa03286b6619043d03aaf543bde24588a96a4e5b`: the viewer protocol, blank session sheet, validation record and README link. Checked factual checkpoints against current tests/UI and confirmed no unresolved review threads or blocking findings. Reran **71 focused unit tests**, checked protocol formatting and whitespace. All **four CI jobs passed**: two Node verification runs and two Cloudflare verification runs.

Squash-merged with an exact-head guard. GitHub reports merge commit **`f19995e8d50f5bf18fdd166f69c961a5727fcc8b`**. Fast-forwarded local main to origin/main, then created `codex/evidence-led-hackathon-demo`. The pre-existing generated `next-env.d.ts` development-path change was preserved and excluded from the new PR.

## Materials reviewed

Reviewed the prior `docs/SUBMISSION.md`, `docs/intelligence/DEMO.md`, October 11 voiceover/captions, media QA, actual video contact sheet, release manifest, submission screenshots, and current viewer-study instructions. Reviewed the original guided Foundry results, provider adapter, question retrieval/verification code, newer offline comparison and October 12 Foundry preflight. Read the official competition rules on October 12. Exact authenticated portal fields were not inspected.

The principal changes are current three-level personalization, a visible shot-surge investigation and its uncertainty, a clear development at 70:00, and two separately labeled Foundry cards. Claims now distinguish current local behavior from the older public release and historical model receipts.

## Application checks

- **71 unit tests passed** in `explanation`, `guided-investigations`, `shot-surge` and `recap-briefing` before the previous PR merge. No application code changed afterward.
- **Production build passed**, including TypeScript checking, with explicit offline/synthetic-only process flags.
- **12 existing browser cases passed** against that production server: four journeys in desktop, Android-sized and iPhone-sized Chromium. They cover level persistence, all six level/recap combinations, guided answer provenance, comparison, evidence/replay and accessibility checks. Some regression cases deliberately mock provider status; none of those mock responses are used in the demonstration capture.
- **Unmocked capture passed** all exact-clock, answer, replay-completion and action-timing assertions. **Zero browser exceptions; zero POST requests.** The dedicated production server reported `mode: offline`, `configured: offline`, `proactive: false`. Production shared usage storage was unavailable (`usageControls: false`); inference stayed disabled and all process quotas were zero.
- The first take stopped because its capture assertion expected arrow notation while Casual Viewer spells out the same counts in words. The assertion was corrected to match actual wording and a complete fresh take passed. No application response or fact was changed. An initial browser-suite invocation refused to reuse an occupied port; the successful run explicitly used the already running production server via the repository's normal local reuse behavior.

Commands used for focused verification:

```sh
AI_ENABLED=false npx vitest run tests/explanation.test.ts tests/guided-investigations.test.ts tests/shot-surge.test.ts tests/recap-briefing.test.ts
AI_ENABLED=false AI_PROVIDER=offline FOUNDRY_ENABLED=false AI_PROACTIVE_ENABLED=false PLAYWRIGHT_PORT=3124 npx playwright test e2e/explanation.spec.ts e2e/guided-investigations.spec.ts --grep 'style persists|all six|offline question|shot surge comparison stays'
```

## Media and factual checks

The [recording receipt](recording-receipt.json) records the application commit, every action cue and request/error observations. The [media QA receipt](media-qa.json) records the output hash, narration timing and format. The [Foundry card provenance](assets/foundry-provenance.json) hashes its original source and records the selected historical plan. Original historical receipt files match the merged base byte-for-byte. Relative document links, exact caption-to-script text, formatting and whitespace checks passed.

- Final video: **116.000 seconds**, four seconds below two minutes; **1920×1080 H.264, 30 fps**; **48 kHz mono AAC**.
- Full-file video/audio decode: **zero errors**. Audio peak **−1.5 dBFS**, mean **−16.1 dB**. Every narration segment fits before its next cue; the largest speech-speed adjustment is **1.0343×** (rounded up).
- **25 captions**, in burned-in, SRT and WebVTT forms. Text is derived from the same scene source as narration. Timing is proportional within measured speech segments, not word-level alignment.
- Visual review: full-timeline contact sheet, actual capture screenshots, full-resolution answer and historical-result frames. Captions sit below the application in a dedicated band. Question enlargements use the same recorded frames; the application text is not edited.
- Persistent source labels identify **synthetic / AI off / local preview** for app footage, the **implementation diagram** at 82–94 seconds, and **historical / October 11 / not live** at 94–108 seconds.
- Local media remains untracked. Committed assets include current screenshots, cards, script/captions and reproducible capture/export tools. Human listening and final presentation review remain for the owner; no human review is invented.

## Limits retained

The historical five model answers matched deterministic baselines and selected no optional follow-ups. They do not validate today's shot-surge workflow or establish extra model value. The broader offline evaluation's equal-xG verdict defect remains documented and unfixed. Passing the selected checks does not pass that broader safety gate. Viewer testing, physical-device Safari and screen-reader review remain pending. The older Azure release does not match this local demo, and no new hosted parity check or deployment was performed.
