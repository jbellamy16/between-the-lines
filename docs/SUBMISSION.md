# Between the Lines — submission preparation

Updated October 12, 2026 (America/Chicago). **Review draft only. No publication, submission, deployment or paid inference in this update.** The current [116-second demonstration package](demo-2026-10-12/README.md) uses a local build after merged PR #34, with three explanation levels. It replaces the October 11 video for this revision. The older [Azure release](https://between-the-lines-jb-f5539b65.azurewebsites.net/) is a separate two-style build; do not describe it as the current demonstration.

Current status: see the [final readiness audit](readiness-2026-10-12/README.md) and [new offline regression evidence](readiness-2026-10-12/offline-regression.json). Registration and eligibility are owner-confirmed. The factual quality-comparison defect is fixed in the open audit PR; deployment parity and a public video URL remain pending.

## Pitch

**More than the score.** You join a football match late. Harbor lead 1–0—but what changed, and is it still happening? Between the Lines turns recorded match events into explanations you can explore: choose Casual Viewer, Football Fan or Advanced Analysis, ask a focused question, inspect its evidence and replay the supporting passage. When evidence cannot establish an explanation, the app says so.

The prototype uses fictional teams and reproducible synthetic events. Microsoft Foundry supports optional structured answer selection over application-retrieved evidence; application code calculates and checks the facts. An existing Azure App Service hosts an older public preview. Five historical Foundry answers matched deterministic baselines, with one appropriate no-call. Added investigative benefit and improved viewer understanding remain unproven.

## Product story

At **63:24**, Harbor lead **1–0** and have taken **four shots after none** in the previous equal period. That is a development worth explaining, but more shots do not establish better chances. The shot-surge investigation compares candidate explanations and concludes that no single explanation is established by these events.

At **70:00**, ask whether the increase has faded. The wider count rose **1 → 4**, while the latest spell's halves fell **3 → 1**. Both facts belong in the story. Inspect the supporting events and replay the **59:09** shot's schematic passage without moving the main clock. Choose the explanation level you need; Quick/Full recap length is a separate control.

The intended benefit is understandable, inspectable match context for casual and knowledgeable viewers. Faster understanding, improved comprehension and audience preferences still require human testing.

## Materials and access status

| Field                        | Prepared value and current status                                                                                                                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project / tagline            | Between the Lines / More than the score.                                                                                                                                                                                                                                           |
| Repository                   | [jbellamy16/second-look](https://github.com/jbellamy16/second-look)                                                                                                                                                                                                                |
| Current demonstration        | [116-second package](demo-2026-10-12/README.md), local build based on `f19995e8d50f5bf18fdd166f69c961a5727fcc8b`; application behavior unchanged by this materials update                                                                                                          |
| Video                        | Local `artifacts/demo-2026-10-12/between-the-lines-demo.mp4`; no public video URL                                                                                                                                                                                                  |
| Script and captions          | [Voiceover](demo-2026-10-12/voiceover-script.txt), [SRT](demo-2026-10-12/captions.srt), [WebVTT](demo-2026-10-12/captions.vtt)                                                                                                                                                     |
| Working public preview       | [Existing Azure application](https://between-the-lines-jb-f5539b65.azurewebsites.net/); October 11 release `2014a497` has two styles and offline AI. Historical identity documented in [release evidence](release-2026-10-11/RELEASE.md); no new hosted parity certification here. |
| Reproduce current experience | [Local setup and exact walkthrough](demo-2026-10-12/WALKTHROUGH.md); free, offline, no keys or account                                                                                                                                                                             |
| Supporting evidence          | [Claims and limitations](demo-2026-10-12/EVIDENCE.md), [Foundry receipt card](demo-2026-10-12/assets/foundry-receipt.png), [validation](demo-2026-10-12/VALIDATION.md)                                                                                                             |
| Proposed category            | Overall; Foundry considered with explicit limits on demonstrated benefit. Category choice and authenticated portal options remain owner decisions.                                                                                                                                 |
| Entry status                 | Registration and eligibility owner-confirmed October 12; authenticated portal fields remain unverified. Nothing submitted.                                                                                                                                                         |

A matching accessible revision and public video URL are still needed before treating this as a complete entry. Demo PR #35 is merged; the readiness fix PR stays open for review. Merging alone does not deploy the application.

## Microsoft technology and AI contribution

| Component                                  | Implemented responsibility                                                                                                                      | Evidence boundary                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microsoft Foundry / Azure OpenAI Responses | Existing GPT-5.4 Mini deployment serves optional structured selections and bounded evidence-query requests.                                     | Historical guided study: five completed answers matched baselines; one no-call. No optional follow-ups selected. This recording makes no model calls.             |
| Application TypeScript                     | Synthetic events, cutoff-safe metrics, equal-window comparisons, evidence retrieval, independent reconstruction and controlled factual wording. | These are deterministic contributions. Application correctness remains a dependency; the numerical quality-comparison defect is corrected in the audit candidate. |
| React / Next.js / SVG                      | Three explanation levels, independent recap lengths, guided questions, evidence and pitch replay.                                               | Current local build, tested in Chromium desktop and touch-size viewports; not a physical Safari-device certification.                                             |
| Azure App Service                          | Existing hosting of the older Next.js standalone release.                                                                                       | No deployment or capacity change in this task; current source/host parity is not claimed.                                                                         |
| GitHub                                     | Public source, review history and automated checks.                                                                                             | CI passing does not establish model quality or human usefulness.                                                                                                  |

The optional path is **application evidence → Foundry structured selection → application verification → explanation**. The application requests initial evidence before inference. Read-only model follow-ups are bounded. Unsupported output or provider failure leads to a deterministic fallback with truthful provenance. There is no implemented Foundry Agent Service, Agent Framework, MCP orchestration, Fabric, managed identity or multi-agent system. Explanation-level switches and pitch replay are local behavior, not fresh AI generation.

## What the results establish

The [October 11 guided campaign](intelligence/guided-investigations/REPORT.md) at evaluated commit `b56090090cf85c43a28ca07755764082d7bcaec3` produced **five verified model answers and one appropriate no-call**, using **five HTTP attempts**. Every completed answer matched the same-question deterministic baseline. **Added investigative benefit was not demonstrated.** These are small synthetic/diagnostic cases assessed by the assistant, not participant evidence or a broad reliability sample.

The [newer offline comparison](intelligence/DIRECTOR-OFFLINE-EVALUATION.md) attributes all 28 additional useful fact–case pairs to deterministic code. It also identifies **11 incorrect equal-xG-as-lower verdicts in every arm**, caused by strict floating-point comparison. That historical gate failed. The [readiness fix and rerun](readiness-2026-10-12/README.md#factual-blocker-fixed) now pass the same diagnostic gate with zero incorrect conclusions; original results remain intact. This does not establish general reliability or live AI value. The [proposed newer Foundry pilot](intelligence/investigation-foundry-2026-10-12/README.md) has not been executed. Older successful receipts do not validate today's shot-surge workflow.

[Viewer usability testing](release-2026-10-11/VIEWER-TEST.md) is prepared, with **zero participant sessions reported**. No claims of comprehension gain, preference, speed improvement or measured real-world impact are supported yet.

## Judge setup and walkthrough

Use the [current local production setup](demo-2026-10-12/WALKTHROUGH.md#start-the-offline-production-preview), not the older Azure version, to reproduce this demonstration. No login, key, payment or model access is required. The timed sequence is:

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

Inter and Barlow Condensed retain their [font licenses](brand/README.md). UI library notices remain in `public/icon-licenses.txt`; dependency licenses apply. The video uses local macOS Samantha synthetic narration, actual application footage, original explanatory cards and no music. Owner eligibility, rights and entry warranties still require confirmation.

## Rules and remaining entry work

Read October 12 from the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md): the video must show functioning software and be **less than two minutes**, with a public video URL and public GitHub repository. Registration closes **October 20 at noon Pacific**; submission closes **October 27 at 11:59 p.m. Pacific**. Project access must remain free through the judging period ending November 10. The authenticated portal was not inspected in this update; exact fields and limits remain unverified.

The owner confirms eligibility/registration. Remaining entry work is review/merge of the numerical fix, matching project access, video publication and authenticated final-entry review. Viewer sessions and stronger AI-value evidence remain uncompleted validation work, not explicit submission requirements. This task prepares reviewable materials only. No terms accepted, participants contacted, entry sent, video uploaded, infrastructure changed or paid campaign started.
