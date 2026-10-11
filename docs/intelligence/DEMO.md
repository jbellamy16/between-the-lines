# Between the Lines — 114-second recording package

Current application: PR #23 merge `fb108863dae6a69a7af0df0101ca1fbc66ab4be1`, Director `1.4.0`. Prepared October 11, 2026. **Local deterministic offline software**, paid AI and proactive inference disabled. This replaces the older receipt-led 100-second flow; historical receipts remain unchanged below.

## Reproducible recording settings

Use the production build and disabled-inference commands in [submission setup](../SUBMISSION.md#judge-setup-and-walkthrough). Fresh browser profile, desktop Chromium, 1920×1080 viewport, 100% zoom, light appearance, neutral team/player preferences, all categories, **The pressure builds**, **Curated demo**, seed **202632**. Main match paused at **63:24**, replay speed **8×**. Recorded-match UI hidden.

For an existing session: Settings → Curated demo → Reset demo; explicitly select Plain English afterward. Reset does not change the saved explanation style. Fresh storage also prevents a previous viewing checkpoint changing recap scope. Confirm “Everything you missed through 63:24.”

Keep **Synthetic demo** and **“Checked from recorded events. AI is off or unavailable.”** visible in opening/closing match views. Add the recording caption **“Local offline demo · synthetic match · current code”** throughout the future video. This is an editing instruction, not a caption already implemented in the application.

Stage a second local tab at **70:00** before the take. Focus Match timeline, press **Home**, **PageUp seven times**, then **ArrowRight 420 times**: Chromium advances 540 seconds per PageUp and one second per arrow. Alternatively drag close and use arrows while watching the clock. Switching tabs is an explicit time jump/edit, not continuous match progression. Automation may fill `4200`, then press ArrowRight and ArrowLeft to commit a native change; confirm the displayed clock, not just the input value.

## Timed narration and exact actions

Target **114 seconds**, including pauses and final hold. Video time is separate from the match clock.

| Video time | Interaction / frame | Narration |
| --- | --- | --- |
| 0–13 | Fresh 63:24 match view: source, score, story, offline label. | “Joining a match late should not mean decoding a wall of statistics. Between the Lines explains what matters. This is our fictional match, running locally with AI switched off.” |
| 13–29 | **Catch me up**. Hold Quick, briefly select **Full recap**, then **Quick recap**. | “Catch Me Up connects the score to the developing story: Harbor lead one nil and are getting more shots away. Quick and Full change how much detail you see.” |
| 29–44 | **Close dialog**. Select **Football Analysis**, hold the windows, then return to **Plain English**. | “Plain English and Football Analysis use the same checked facts. Here, four shots replace zero in equal periods. Changing the explanation leaves the score, match position and evidence intact.” |
| 44–60 | **Explore evidence**. Scroll to definitions and events; point to both windows and **59:09 · Milo Serrano**. | “Every story has something you can inspect. These are the comparison periods and the actual supporting shots. More attempts do not automatically mean better chances.” |
| 60–76 | Click **Replay shot at 59:09**. Frame the pitch; let six actions finish at 8×. | “Choose Milo Serrano's shot and replay the recorded passage. A recovery, passes and a carry lead to the attempt. These are schematic event positions, not player tracking or broadcast footage.” |
| 76–91 | Cut/switch to staged **70:00**, Plain English. Frame the qualification. | “Now jump to seventy minutes. The increase has eased: one shot in the later half of the spell, after three. The explanation changes when the evidence weakens.” |
| 91–110 | Hold working app and offline label. Optional caption: **Foundry selects · application verifies and renders**. No investigation click. | “When enabled, Microsoft Foundry can select stories and request bounded evidence checks. Our application calculates the measurements, independently verifies the selected claims, and renders both styles. Historical Foundry tests exist; this revised workflow still needs live evaluation and human review.” |
| 110–114 | Hold app/product identity. | “Between the Lines. More than the score.” |

No tour of Stats, Lineups, player focus, export or every storyline state. Those remain available for judges. Never depict a mocked provider response as successful live execution.

## Verified checkpoints

| State | Evidence |
| --- | --- |
| 63:24 / 3804 seconds | Harbor **1–0**; Arlo Hayes goal **01:00**. Harbor shots **4 vs 0**, current **54:12–63:24**, previous **45:00–54:12**. None of those four scored. |
| Shot evidence | Arlo Hayes **55:42**, Milo Serrano **59:09**, Theo March **61:19**, **62:50**. |
| Replay | Recovery **58:39**, passes **58:49**, **58:56**, **59:04**, carry **59:07**, shot **59:09**. Source IDs `pressure-202632-430` through `pressure-202632-435`. Six actions over 30 recorded seconds, about 3.75 seconds at 8× plus render/hold time. Main clock stays 63:24. |
| 70:00 / 4200 seconds | Score **1–0**. Shots **4 vs 1**, current **57:30–70:00**, previous **45:00–57:30**. Current first half **3**, second half **1**. “Harbor's increase in shots has eased within this spell.” |

The optional **How the match story is changing** disclosure at 70:00 shows Harbor recoveries weakening from three to one across completed five-minute spells. Recoveries only; a different comparison. Verified for judge exploration, omitted from the timed take.

## Current screenshots and rehearsal

Unaltered captures of the current local app, not mockups or live model results:

| Frame | Screenshot |
| --- | --- |
| Join | [01-join.jpg](../submission-preparation/screenshots/01-join.jpg) |
| Catch Me Up | [02-catch-me-up.jpg](../submission-preparation/screenshots/02-catch-me-up.jpg) |
| Football Analysis | [03-football-analysis.jpg](../submission-preparation/screenshots/03-football-analysis.jpg) |
| Evidence | [04-evidence.jpg](../submission-preparation/screenshots/04-evidence.jpg) |
| Replay | [05-replay.jpg](../submission-preparation/screenshots/05-replay.jpg) |
| Weakening | [06-weakening.jpg](../submission-preparation/screenshots/06-weakening.jpg) |

[Validation and timing](../submission-preparation/VALIDATION.md) · [timing receipt](../submission-preparation/rehearsal.json). A timed interaction rehearsal demonstrates that actions fit; it is not a human voice recording. The recorder still needs an aloud take, caption proofreading and exported-duration check.

## Historical Foundry receipt — outside the timed take

If discussed, label it: **“Historical Microsoft Foundry result · October 10, 2026 America/Chicago · Director 1.2.0 · commit 22fb005 · not live; does not validate Director 1.4.0.”** Some receipt timestamps fall on October 11 UTC; preserve original values.

The [saved receipt](pr18-intelligence-2026-10-10/demo-receipt.html), [results](pr18-intelligence-2026-10-10/results.json) case `temporal-emerging`, and [HTTP receipts](pr18-intelligence-2026-10-10/requests.json) attempts 15/16 record **65:00**, legacy Fan mode, seed 202632. Foundry selected four shots versus zero and the 58:39→59:09 passage. The application required broad retrieval; the model made **no optional follow-up** in that successful case. Legacy Fan mode is not the current Plain English preference.

That study's 70:00 and 75:00 investigations failed under provider quota; an unseen-seed follow-up also failed before publication. Preserve the failures in the [report](pr18-intelligence-2026-10-10/REPORT.md). Do not reuse its closed spending allowance, inject old responses into the current UI or imply the current weakening scene is Foundry-generated.
