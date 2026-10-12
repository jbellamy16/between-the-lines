# Between the Lines — submission preparation

**Publication review, October 12:** [Final media and publication handoff](publication-2026-10-12/README.md) verifies the demonstrated public behavior and prepares the YouTube title, description and English upload captions. The original Samantha system-voice audio is not cleared for public sharing under Apple's license. A separate silent captioned version is prepared; owner selection or replacement narration, supplied-crest rights confirmation, YouTube channel setup and explicit publication approval remain pending. **No public video URL; nothing uploaded or submitted.** PR #44 passed all four checks and was merged; this publication documentation is left in a new unmerged PR.

Updated October 12, 2026 (America/Chicago). **Entry remains a review draft. The reviewed application is now deployed; no video publication, submission or paid inference occurred.** The current [116-second demonstration package](demo-2026-10-12/README.md) uses a local build after merged PR #34, with three explanation levels. It replaces the October 11 video for this revision. The [public Azure release](https://between-the-lines-jb-f5539b65.azurewebsites.net/) now serves reviewed commit `10cd0aa68c4f1fab07aef2b244992c46879f44c7`, including all three explanation levels and the current demo checkpoints. See the [October 12 release record](release-2026-10-12/RELEASE.md).

Current status: see the [final readiness audit](readiness-2026-10-12/README.md) and [new offline regression evidence](readiness-2026-10-12/offline-regression.json). Registration and eligibility are owner-confirmed. The factual quality-comparison fix is merged and included in the public release. Deployment parity is verified; the public video URL and authenticated final-entry review remain pending.

## Pitch

**More than the score.** You join a football match late. Harbor lead 1–0—but what changed, and is it still happening? Between the Lines turns recorded match events into explanations you can explore: choose Casual Viewer, Football Fan or Advanced Analysis, ask a focused question, inspect its evidence and replay the supporting passage. When evidence cannot establish an explanation, the app says so.

The prototype uses fictional teams and reproducible synthetic events. Microsoft Foundry supports optional structured answer selection over application-retrieved evidence; application code calculates and checks the facts. The existing Azure App Service hosts the reviewed current application with public AI disabled. Five historical Foundry answers matched deterministic baselines, with one appropriate no-call. Added investigative benefit and improved viewer understanding remain unproven.

## Product story

At **63:24**, Harbor lead **1–0** and have taken **four shots after none** in the previous equal period. That is a development worth explaining, but more shots do not establish better chances. The shot-surge investigation compares candidate explanations and concludes that no single explanation is established by these events.

At **70:00**, ask whether the increase has faded. The wider count rose **1 → 4**, while the latest spell's halves fell **3 → 1**. Both facts belong in the story. Inspect the supporting events and replay the **59:09** shot's schematic passage without moving the main clock. Choose the explanation level you need; Quick/Full recap length is a separate control.

The intended benefit is understandable, inspectable match context for casual and knowledgeable viewers. Faster understanding, improved comprehension and audience preferences still require human testing.

## Materials and access status

| Field                        | Prepared value and current status                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project / tagline            | Between the Lines / More than the score.                                                                                                                                                                                                                     |
| Repository                   | [jbellamy16/second-look](https://github.com/jbellamy16/second-look)                                                                                                                                                                                          |
| Current demonstration        | [116-second package](demo-2026-10-12/README.md), local build based on `f19995e8d50f5bf18fdd166f69c961a5727fcc8b`; application behavior unchanged by this materials update                                                                                    |
| Video                        | Local `artifacts/demo-2026-10-12/between-the-lines-demo.mp4`; no public video URL                                                                                                                                                                            |
| Script and captions          | [Voiceover](demo-2026-10-12/voiceover-script.txt), [SRT](demo-2026-10-12/captions.srt), [WebVTT](demo-2026-10-12/captions.vtt)                                                                                                                               |
| Working public preview       | [Existing Azure application](https://between-the-lines-jb-f5539b65.azurewebsites.net/); October 12 release `10cd0aa6` has all three explanation levels, shot-surge investigation and offline AI; [verified release evidence](release-2026-10-12/RELEASE.md). |
| Reproduce current experience | [Local setup and exact walkthrough](demo-2026-10-12/WALKTHROUGH.md); free, offline, no keys or account                                                                                                                                                       |
| Supporting evidence          | [Claims and limitations](demo-2026-10-12/EVIDENCE.md), [Foundry receipt card](demo-2026-10-12/assets/foundry-receipt.png), [validation](demo-2026-10-12/VALIDATION.md)                                                                                       |
| Proposed category            | Overall; Foundry considered with explicit limits on demonstrated benefit. Category choice and authenticated portal options remain owner decisions.                                                                                                           |
| Entry status                 | Registration and eligibility owner-confirmed October 12; authenticated portal fields remain unverified. Nothing submitted.                                                                                                                                   |

The matching accessible revision is deployed. A public video URL and authenticated final-entry review are still needed before treating this as a complete entry. Demo PR #35 and the readiness fix PR #36 are merged; the reviewed release through PR #43 is on Azure.

## Microsoft technology and AI contribution

| Component                                  | Implemented responsibility                                                                                                                      | Evidence boundary                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microsoft Foundry / Azure OpenAI Responses | Existing GPT-5.4 Mini deployment serves optional structured selections and bounded evidence-query requests.                                     | Historical guided study: five completed answers matched baselines; one no-call. No optional follow-ups selected. This recording makes no model calls.              |
| Application TypeScript                     | Synthetic events, cutoff-safe metrics, equal-window comparisons, evidence retrieval, independent reconstruction and controlled factual wording. | These are deterministic contributions. Application correctness remains a dependency; the numerical quality-comparison defect is corrected in the deployed release. |
| React / Next.js / SVG                      | Three explanation levels, independent recap lengths, guided questions, evidence and pitch replay.                                               | Public release tested in Chromium desktop and touch-size viewports; not a physical Safari-device certification.                                                    |
| Azure App Service                          | Existing hosting of the reviewed Next.js standalone release.                                                                                    | October 12 deployment verified against `/release.json`; capacity and spending controls unchanged.                                                                  |
| GitHub                                     | Public source, review history and automated checks.                                                                                             | CI passing does not establish model quality or human usefulness.                                                                                                   |

The optional path is **application evidence → Foundry structured selection → application verification → explanation**. The application requests initial evidence before inference. Read-only model follow-ups are bounded. Unsupported output or provider failure leads to a deterministic fallback with truthful provenance. There is no implemented Foundry Agent Service, Agent Framework, MCP orchestration, Fabric, managed identity or multi-agent system. Explanation-level switches and pitch replay are local behavior, not fresh AI generation.

## What the results establish

The [October 11 guided campaign](intelligence/guided-investigations/REPORT.md) at evaluated commit `b56090090cf85c43a28ca07755764082d7bcaec3` produced **five verified model answers and one appropriate no-call**, using **five HTTP attempts**. Every completed answer matched the same-question deterministic baseline. **Added investigative benefit was not demonstrated.** These are small synthetic/diagnostic cases assessed by the assistant, not participant evidence or a broad reliability sample.

The [newer offline comparison](intelligence/DIRECTOR-OFFLINE-EVALUATION.md) attributes all 28 additional useful fact–case pairs to deterministic code. It also identifies **11 incorrect equal-xG-as-lower verdicts in every arm**, caused by strict floating-point comparison. That historical gate failed. The [readiness fix and rerun](readiness-2026-10-12/README.md#factual-blocker-fixed) now pass the same diagnostic gate with zero incorrect conclusions; original results remain intact. This does not establish general reliability or live AI value. The [proposed newer Foundry pilot](intelligence/investigation-foundry-2026-10-12/README.md) has not been executed. Older successful receipts do not validate today's shot-surge workflow.

[Viewer usability testing](release-2026-10-11/VIEWER-TEST.md) is prepared, with **zero participant sessions reported**. No claims of comprehension gain, preference, speed improvement or measured real-world impact are supported yet.

## Judge setup and walkthrough

Use the [public Azure application](https://between-the-lines-jb-f5539b65.azurewebsites.net/) or the [local production setup](demo-2026-10-12/WALKTHROUGH.md#start-the-offline-production-preview) to reproduce the demonstration. The walkthrough’s note about the older Azure build is historical; the October 12 [release validation](release-2026-10-12/RELEASE.md) supersedes it. No login, key, payment or model access is required. The timed sequence is:

1. **0–22 seconds:** join at 63:24, Harbor 1–0; read 0 → 4 shots and the chance-quality limitation.
2. **22–38:** Catch Me Up; compare all three explanation levels, then Quick/Full independently.
3. **38–53:** ask **What best describes this shot surge?**; inspect comparisons and “no single explanation.”
4. **53–69:** explicitly jump to 70:00; ask **Has this increase already faded?**; compare wider 1 → 4 with recent 3 → 1.
5. **69–82:** expand answer evidence and replay **59:09 · shot · Replay**, a six-action passage starting at 58:39; main clock stays 70:00.
6. **82–108:** separate implementation and historical-result cards explain Foundry's actual role and demonstrated limits.
7. **108–116:** return to the current recap; acknowledge pending viewer testing and close.

The exact controls, reset behavior, recording tools and limitations are in the walkthrough. The original unmocked recording and final media remain local. No historical response is injected into the present application.

## Source attribution

Fictional Harbor Athletic, Riverside FC, players, seeded events, pitch graphics and Between the Lines identity are project assets. Replays visualize synthetic event endpoints, not licensed match footage. Historical Wyscout notices remain in the repository; StatsBomb research data is not exposed by this configuration. See [data rights](DATA-RIGHTS.md).

Inter and Barlow Condensed retain their [font licenses](brand/README.md). UI library notices remain in `public/icon-licenses.txt`; dependency licenses apply. The original video uses local macOS Samantha narration, actual application footage, original explanatory cards and no music. [Apple's macOS Tahoe license §2F](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf) restricts that system voice from public sharing; do not publish the original audio without separate permission. The prepared silent derivative removes it while preserving the picture and burned-in captions. The two fictional-club crests were user-supplied; confirmation of ownership or publication/competition reuse permission remains needed. Owner entry warranties remain pending.

## Rules and remaining entry work

Read October 12 from the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md): the video must show functioning software and be **less than two minutes**, with a public video URL and public GitHub repository. Registration closes **October 20 at noon Pacific**; submission closes **October 27 at 11:59 p.m. Pacific**. Project access must remain free through the judging period ending November 10. The authenticated portal was not inspected in this update; exact fields and limits remain unverified.

The owner confirms eligibility/registration. The numerical fix is merged and matching public project access is verified. Remaining entry work is the audio/rights decision, YouTube channel setup, explicit publication approval, signed-out playback/caption verification and authenticated final-entry review. Viewer sessions and stronger AI-value evidence remain uncompleted validation work, not explicit submission requirements. Release documentation PR #44 is merged; publication documentation remains unmerged for review. No terms were accepted, participants contacted, entry sent, video uploaded, infrastructure provisioned or paid campaign started. Existing hosting and spending settings remain unchanged.
