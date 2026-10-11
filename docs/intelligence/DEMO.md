# A reproducible 100-second intelligence demonstration

## Honest recording mode

This walkthrough uses **Harbor Athletic–Riverside FC, pressure scenario, demo profile, seed 202632**. These are project-owned synthetic events and fictional teams. The shipped generator is unchanged. Do not use historical fixtures, broadcast footage or real club imagery in the hackathon submission.

The new engine has been exercised offline and with scripted transport tests. There is no authorized live Foundry run of this version and no recorded improved-model result to present as one. Record the current walkthrough with the visible **Deterministic offline** source label. Do not add a simulated “Foundry investigating” animation or relabel an offline result. The proposed narration below names Foundry's architectural contribution without claiming that this recording made a model request.

If a bounded live evaluation is separately authorized, replace the 24–39-second architecture segment with the real provider request and returned trace. Keep the source/model, exact cutoff, usage, cost and success/failure receipt. Record what the model actually selects; do not promise a particular follow-up. If playback uses that recording later, label it “Recorded verified Foundry investigation,” include its version and timestamp, and distinguish the recorded request from current playback. An older `1.1.2` receipt cannot validate a new-engine response.

## Setup and observable checkpoints

Run the production build locally and open the app. Choose the pressure scenario and demo generator profile. Pause playback. Use the match timeline to seek to the listed seconds; the initial view at 63:24 is a convenient prelude. Keep the existing source label and score visible. Use the evidence disclosure and replay controls; a generic chat window is unnecessary.

| Match time      | Timeline seconds | Verified expected behavior                                                                                                                                                                                                  |
| --------------- | ---------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 63:24           |             3804 | Harbor has four shots in 54:12–63:24 versus zero in the preceding equal interval. No complete five-minute storyline has emerged yet. The wider-window observation and shorter storyline cadence are different measurements. |
| 65:00           |             3900 | Harbor's attacking-third recovery storyline emerges: three recoveries in 60:00–65:00 versus one in 55:00–60:00. This describes recorded recovery locations, not pressing intensity.                                         |
| 70:00           |             4200 | The same Harbor recovery storyline weakens: one recovery in 65:00–70:00. Its episode baseline remains one.                                                                                                                  |
| 75:00           |             4500 | The Harbor recovery storyline resolves after zero recoveries in 70:00–75:00, its second consecutive below-threshold interval. A separate Riverside recovery storyline emerges with two versus zero.                         |
| Rewind to 65:00 |             3900 | The Harbor story is emerging again with the earlier evidence. The later resolution and Riverside development are absent.                                                                                                    |

The stable Harbor recovery identity is `pressure:storyline:2H:harbor:attacking-third-recoveries`. The state changes on completed five-minute windows; it does not claim to detect a tactical change at the instant of an event. A zero means no qualifying recovery was recorded, not proof of no pressure or no off-ball activity.

Optional second arc: Harbor shots emerge at 80:00 (three versus one), weaken at 85:00 (one), and resolve at 90:00 (zero). Use the primary recovery arc for the 100-second recording so the viewer follows one story.

## Video script: 100 seconds

| Video time | Screen action                                                      | Narration                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–10 s     | Full match view at 63:24; source label visible                     | “A statistic can be correct and still leave you asking what it means. Between the Lines connects a football observation to its evidence—and follows what happens next.”                                                                                                |
| 10–24 s    | Seek to 65:00; show the emerging Harbor recovery storyline         | “In this reproducible synthetic match, Harbor records three high recoveries in five minutes, up from one. A possible story is emerging. That is evidence of recorded actions, not proof of pressing intensity.”                                                        |
| 24–39 s    | Open investigation/evidence disclosure; preserve the offline label | “This recording shows the deterministic verified engine. In the Microsoft Foundry workflow, the model chooses a useful follow-up: investigate a sequence, a player, a comparison, or counter-evidence. The server independently checks the result before publication.” |
| 39–53 s    | Show support, caveats and a next-window criterion                  | “The explanation separates what is observed from what remains uncertain. More activity does not automatically mean better chances. A specific next-window criterion makes the story testable.”                                                                         |
| 53–68 s    | Replay linked recorded events on the existing pitch                | “Every observation links back to the actions behind it. Fans get a clear explanation. Analysts can inspect the measurement, source limits and exact events, then replay the passage.”                                                                                  |
| 68–82 s    | Seek to 70:00, then 75:00; show weakening then resolved            | “Now the story changes. Harbor records one recovery in the next window, then none. The earlier increase was real, but it did not persist. The engine weakens and resolves the same storyline.”                                                                         |
| 82–92 s    | Rewind to 65:00                                                    | “Rewind, and the system reconstructs only what was known then. The later resolution disappears. Future events cannot quietly influence an earlier explanation.”                                                                                                        |
| 92–100 s   | Show broadcast preview/export briefly; return to match             | “One verified story can serve the match experience or a broadcast graphic. The value is a football insight viewers can understand, question and replay.”                                                                                                               |

Timing assumes approximately 145 spoken words per minute with brief pauses for the timeline and replay. Rehearse against the visible controls; cut pauses rather than speeding through evidence. Keep most technical details collapsed. Do not fill waiting time with fabricated tool calls.

## What the demonstration establishes

The offline recording demonstrates traceability, explicit uncertainty, measured story evolution, rewind safety and reusable presentation. The scripted test `scripted Foundry selectively investigates counter-evidence` proves that the actual transport/tool/publication path supports that bounded investigation with a stubbed provider; it does not establish live model choices or editorial superiority.

A separately authorized live demonstration is still needed to show this version's real model-directed behavior. Blinded football review is still needed for “the AI found something better than the baseline.” An exported broadcast preview demonstrates a reusable contract, not production broadcaster adoption.

Reproduce the automated foundation with `npx vitest run tests/intelligence-evaluation.test.ts tests/storylines.test.ts`. The machine-readable comparison is `artifacts/intelligence-evaluation.json`; [the evaluation note](EVOLUTION.md) explains the frozen original, challenge matrix and human rubric.
