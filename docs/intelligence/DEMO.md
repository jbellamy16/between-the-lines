# Historical October 11 demonstration — 113 seconds

**Superseded for current preparation by the [October 12, 116-second review package](../demo-2026-10-12/README.md).** This document and its media describe the older two-style public release. Retained as historical evidence; do not use its controls or publication instructions for the current revision.

Recorded October 11, 2026 from the actual [public Azure application](https://between-the-lines-jb-f5539b65.azurewebsites.net/), commit **2014a497c84c799952c218a0229ec0c16bd964b1**. The footage is a continuous signed-out Chromium recording with functioning controls, not a screenshot sequence or rehearsal. Public AI and proactive inference are disabled. No intercepted/model responses appear in the recording; it made zero POST requests.

## Local deliverables

All video/audio media remain local and untracked; no video has been published.

- `artifacts/final-release-2026-10-11/demo/between-the-lines-demo.mp4`: final **113.000 seconds**, 1920×1080 H.264 at 30 fps, AAC narration, readable burned-in captions.
- `artifacts/final-release-2026-10-11/demo/screen-recording.webm`: original actual application capture, including its initial loading interval.
- `artifacts/final-release-2026-10-11/demo/narration.wav`: neutral macOS Samantha synthetic narration, generated locally with no remote model call.
- [Final timed voiceover](../release-2026-10-11/voiceover-script.txt) and [SRT captions](../release-2026-10-11/captions.srt); a WebVTT copy is alongside the MP4.
- `artifacts/final-release-2026-10-11/demo/recording-receipt.json`: action timestamps, release identity and request/error observations.
- `artifacts/final-release-2026-10-11/demo/export-receipt.json`: encoding and trim information. The answer inset is a magnified crop of the same recorded frames; no application facts were edited.

The local submission ZIP includes the final media and writing assets. The script, raw footage, narration segments and export tooling are retained for corrections. The persistent caption identifies **SYNTHETIC MATCH | AI OFF | PUBLIC AZURE RELEASE**. No music or third-party match footage is used.

## Final timed narration and actions

| Video time | Actual interaction                                    | Narration                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–12s      | Join at 63:24                                         | Joining a match late should not mean decoding a wall of statistics. Between the Lines explains what changed. This is the public Azure release, with fictional teams and AI switched off.                                                                                                                                                                                                                                          |
| 12–27s     | Catch Me Up: Quick and Full                           | Harbor lead one nil. Catch Me Up connects that score to the story: four shots in the latest spell, after none in the previous equal period. Quick and Full control how much recap you see.                                                                                                                                                                                                                                        |
| 27–40s     | Plain English and Football Analysis                   | Plain English and Football Analysis explain the same checked facts. Style and recap length are independent. More shots do not prove better chances: there were no earlier shots to compare for average quality.                                                                                                                                                                                                                   |
| 40–63s     | Jump to 70:00; guided fading question                 | Now jump to seventy minutes and ask: has this increase already faded? The direct answer is yes. Across the wider windows, shots rose from one to four. But inside the latest window, they fell from three to one. That slowdown does not erase the wider increase, or predict what happens next.                                                                                                                                  |
| 63–79s     | Answer evidence and shot replay                       | Open the answer evidence to inspect those counts. Choose the fifty nine oh nine shot and replay its recorded passage. These are schematic event positions, not player tracking or broadcast footage. The match clock stays at seventy minutes.                                                                                                                                                                                    |
| 79–108s    | Working app; optional Foundry role and honest results | Microsoft Foundry is an optional investigator: it can select claims and request bounded evidence checks. Application code calculates, independently verifies, and renders the facts. In the completed guided study, five model answers matched the deterministic baseline, with one correct no call. Additional investigative benefit was not demonstrated. Public AI remains disabled, and real viewer testing is still pending. |
| 108–113s   | Final app hold                                        | Between the Lines. More than the score. Explore the working demo.                                                                                                                                                                                                                                                                                                                                                                 |

## Review and publication instructions

The exported file was decoded end to end. Duration is 113 seconds (seven seconds below the competition limit); it contains 3,390 video frames and a 48 kHz mono narration track. Narration fits each timed segment, with deliberate holds and no clipped ending. Audio peak is -1.5 dBFS. Opening, recap/style changes, the guided direct answer, evidence, animated replay and final hold were visually inspected. Captions were checked against the final script and placed in a separate lower band; the question answer is magnified at 46–62 seconds. See the local QA receipt for technical measurements and review frames.

The demonstration identifies its synthetic/offline state. Foundry is described as optional; the five matching model answers, correct no-call, lack of demonstrated extra benefit and pending human review are stated explicitly. It does not portray live AI success or assert that viewers found the product useful.

Owner: review the final file, then publish to an allowed public video host (for example YouTube or Vimeo) when authorized. Suggested title: **Between the Lines — More than the score**. Description: “A synthetic football intelligence demo on Azure App Service. Deterministic public experience; optional Microsoft Foundry investigations with independently verified evidence. Public AI is disabled. App: https://between-the-lines-jb-f5539b65.azurewebsites.net/ · Source: https://github.com/jbellamy16/second-look”. Upload the SRT, verify signed-out access and processed duration, then insert the public video URL into the submission. No publication or entry submission has occurred.

## Reproduce the walkthrough

Use the [judge walkthrough](../SUBMISSION.md#judge-setup-and-walkthrough): The pressure builds, Curated demo, seed 202632, fresh storage, paused at 63:24. The narrated jump is explicitly to 70:00, not continuous match time. At 70:00 choose **Has this increase already faded?**, then **Explore answer evidence → 59:09 · shot · Replay**. Six actions span 58:39–59:09; the main match clock stays at 70:00. Both explanation styles and both recap lengths operate independently.

## Historical Foundry receipt — outside the timed take

If discussed, label it: **“Historical Microsoft Foundry result · October 10, 2026 America/Chicago · Director 1.2.0 · commit 22fb005 · not live; does not validate Director 1.4.0.”** Some receipt timestamps fall on October 11 UTC; preserve original values.

The [saved receipt](pr18-intelligence-2026-10-10/demo-receipt.html), [results](pr18-intelligence-2026-10-10/results.json) case `temporal-emerging`, and [HTTP receipts](pr18-intelligence-2026-10-10/requests.json) attempts 15/16 record **65:00**, legacy Fan mode, seed 202632. Foundry selected four shots versus zero and the 58:39→59:09 passage. The application required broad retrieval; the model made **no optional follow-up** in that successful case. Legacy Fan mode is not the current Plain English preference.

That study's 70:00 and 75:00 investigations failed under provider quota; an unseen-seed follow-up also failed before publication. Preserve the failures in the [report](pr18-intelligence-2026-10-10/REPORT.md). Do not reuse its closed spending allowance, inject old responses into the current UI or imply the current weakening scene is Foundry-generated.
