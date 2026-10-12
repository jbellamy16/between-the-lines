# Follow the story, then check the evidence

**Later audit update:** The [readiness candidate](../readiness-2026-10-12/README.md) corrects the equal-quality verdict defect and passes the same offline conclusion-safety gate. The original recording/study findings below remain historical evidence; they have not been rewritten or reclassified. Public deployment parity and video publication are still pending.

October 12, 2026. **Current review package: 116 seconds. Local preview only; no publication, submission, deployment or paid inference.** Supersedes the October 11 video for this revision. The historical release and receipts remain intact. This is a demonstration/materials update, with no application behavior changes.

## Start here

- [Timed voiceover](voiceover-script.txt) · [Scene source](scenes.json) · [SRT](captions.srt) · [WebVTT](captions.vtt)
- [Exact walkthrough and recording setup](WALKTHROUGH.md)
- [Claims, source evidence and judge questions](EVIDENCE.md)
- [Validation, previous PR review and media measurements](VALIDATION.md)
- Local video: `artifacts/demo-2026-10-12/between-the-lines-demo.mp4` (untracked, deliberately unpublished).
- Local original recording, narration, export receipt and contact sheet are beside the video. Committed screenshots and Foundry cards are in [assets](assets/).

## The story

A viewer joins at 63:24. Harbor lead 1–0, but the score does not tell them about a recent rise in shots. They choose their explanation level, investigate what could account for the rise, then move to 70:00 and discover that the latest activity has eased. They can inspect the supporting events and replay an individual passage. The product's promise is understandable, inspectable match context; faster or better viewer understanding remains a hypothesis awaiting human testing.

Show the functioning product for 90 of the 116 seconds. Use the remaining 26 seconds to explain the implemented Foundry boundary and show a historical result with its actual limits. Technical judges see structured output, independent application checks and traceable original receipts. Nontechnical judges follow one football question through to a visible answer and its evidence.

| Time    | What judges see                                 | Point to land                                                                     |
| ------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| 0–10    | Score at 63:24; main story                      | The score leaves a question unanswered.                                           |
| 10–22   | 0 → 4 shots in equal spells; qualification      | A meaningful development, without claiming better chances.                        |
| 22–38   | Catch Me Up; all three levels; Quick/Full       | Personalize the explanation while retaining facts and limits.                     |
| 38–53   | Shot-surge question, comparison and limitations | A useful investigation can conclude that no single explanation is established.    |
| 53–69   | Explicit jump to 70:00; fading question         | Wider increase 1 → 4; recent halves 3 → 1. Both are true.                         |
| 69–82   | Answer evidence, 59:09 shot replay              | Check the claim against recorded synthetic actions.                               |
| 82–94   | Labeled architecture illustration               | Foundry selects structured answers; application code computes and checks.         |
| 94–108  | Labeled historical result card                  | Five model answers matched baselines; one no-call; no demonstrated extra benefit. |
| 108–116 | Current catch-up summary                        | Viewer testing pending; AI off; close on the viewer's task.                       |

## Changes from the previous demonstration

The October 11 video showed the deployed two-style interface, one guided question and an extended spoken Foundry explanation over unrelated app screens. This cut uses the current three-level interface, shows an actual comparison and its uncertainty before the developing answer, and replaces the final explanation with a short architecture card and an original-receipt-derived result card. The score, question and replay stay in one fictional match.

The current build and historical Foundry study are explicitly separate. We do not replay historical model output inside today's interface. No scripted or mocked model success appears in this footage. The known broader chance-quality defect is disclosed in the evidence notes; these selected scenes are not a general reliability or release-readiness claim.

## Review handoff

Review the local video with its captions and use the walkthrough against this branch's build. The public Azure release is older and cannot reproduce the three-level demonstration. A later deployment and a public video URL are still needed for a matching entry; neither is authorized by this task. Keep the new PR unmerged for review.
