# Viewer test — 8 minutes, no AI calls

Use the public [Between the Lines release](https://between-the-lines-jb-f5539b65.azurewebsites.net/) in a private browser window. The match is fictional and deterministic. Recruit at least one casual viewer and one knowledgeable football viewer; this is a small formative test, not a statistically representative study. No participants have been contacted and no responses have been collected.

## Setup and exact checkpoints

Fresh session: **The pressure builds**, **Curated demo**, seed **202632**, paused at **63:24**, Harbor **1–0** Riverside. If needed use Settings → Curated demo → Reset demo, then select Plain English. Keep all categories enabled and team/player preferences neutral. In Settings, the generator profile is called Curated demo. The URL stays the same throughout; there are no shareable time-query links.

For **70:00**, keep playback paused. Drag the Match timeline near 70:00, then focus it and use the left/right arrow keys for one-second adjustments. Confirm the visible clock. A facilitator can set this checkpoint before task 3. For kickoff press Home. Replay does not move the match clock.

## Tasks and neutral questions

Do not teach the answer before the participant tries. Record completion unaided / prompted / failed, time in seconds and the participant's actual words. Ask permission before collecting identifiable comments; initials or anonymous IDs suffice.

1. **Score/statistics baseline (45 seconds).** At 63:24 show only the score and Match stats. Ask: “What can you tell about how the match has changed recently? What can't these numbers establish?” Record their explanation and confidence (1–5).
2. **Story and qualification (60 seconds).** Return to Match centre and read the main story. Ask: “What changed? Does this establish that Harbor's chances are better?” Correct understanding: 0 → 4 shots in equal 9m12s periods; none scored; more attempts do not establish better chances. Quality comparison is unavailable because the earlier period has no shots. Record changes from the baseline, including any new misconception. This within-person comparison has order/learning bias; do not call it a controlled experiment.
3. **Guided answer (90 seconds).** At 70:00 ask them to find out whether the increase has already faded. They should choose **Has this increase already faded?** and explain the direct answer: wider comparison 1 → 4 shots, but recent halves 3 → 1. Ask: “Does that erase the wider increase or predict the next goal?” Both answers are no.
4. **Evidence and replay (90 seconds).** Open **Explore answer evidence**, locate **59:09 · shot · Replay**, and replay the event. Ask what the pitch actually shows. Correct: schematic recorded event positions and actions, not tracking, continuous movement, broadcast footage or a causal proof. The match clock should remain 70:00.
5. **Style versus length (90 seconds).** Open Catch me up, choose Full and Quick, then Football Analysis and Plain English. Ask: “Which changes the language? Which changes the amount of recap? Did the underlying facts change?” Correct: explanation style changes presentation; recap length changes breadth/detail; facts stay the same. Ask which style helped them answer the earlier question and why.

## Compact response template

Copy one record per real participant; leave missing fields blank.

```text
Participant ID / date:
Football familiarity: casual / knowledgeable / other (explain)
Device/browser:
Checkpoint and release commit (see /release.json):
Task                  Completion (unaided/prompted/failed)   Seconds   Actual explanation/comment
Score/stats baseline:
Story + qualification:
Guided fading answer:
Evidence + replay:
Style versus length:
Comprehension (0=incorrect, 1=partial, 2=correct):
  Change in shots __/2; quality caveat __/2; wider vs recent windows __/2;
  replay limitations __/2; style vs length __/2. Total __/10.
Confidence before / after (1–5):
Misconceptions (quote exact wording):
Most useful evidence and why:
Point of confusion / suggested change:
Facilitator prompts given:
```

Report individual observations before aggregating. Distinguish clearer explanations from simple familiarity with the task. Human validation remains **pending** until actual responses arrive; assistant checks and automated tests are not participant feedback.
