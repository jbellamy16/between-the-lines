# Between the Lines — publication review

October 12, 2026 (America/Chicago). **Prepared, not uploaded or published. No final video URL exists.** Application behavior, Azure infrastructure, inference controls and historical evaluations were not changed.

## Decision

The demonstrated functionality works on the current public Azure release. The original 116-second recording is technically valid and its claims are appropriately limited, but **its macOS Samantha narration is not cleared for public publication**. A separate captioned, audio-free derivative has been prepared. The owner must select that version or supply narration with publication rights, confirm the supplied club artwork rights, complete YouTube channel setup, and explicitly authorize publication.

The authenticated Firefox account reached YouTube's **Create channel** dialog when opening Studio. It requires agreement to YouTube's Terms of Service. The dialog was canceled without creating a channel. The in-app browser was signed out. No upload, account change, terms acceptance or hackathon submission occurred.

## Ready materials

- Title: **Between the Lines | Follow the Story, Check the Evidence | Hackathon Demo**
- [YouTube description](youtube-description.txt) and [title file](youtube-title.txt).
- [English SRT](between-the-lines.en.srt) and [WebVTT](between-the-lines.en.vtt), upload with timing. They exactly match the original scene text and timestamps.
- Original video, unchanged: `artifacts/demo-2026-10-12/between-the-lines-demo.mp4` in the original checkout.
- Prepared alternative, also in the original checkout: `artifacts/publication-2026-10-12/between-the-lines-captioned-no-audio.mp4`. This is deliberately silent; the existing burned-in captions and every video frame are retained. It is not yet the owner-selected final cut.
- Original timed narration: [voiceover-script.txt](../demo-2026-10-12/voiceover-script.txt). If replacement speech is supplied, align it to these scene boundaries and revalidate captions, levels and duration before requesting approval for that new version.
- [Machine-readable validation](validation.json), [caption checks](caption-validation.json), [PR #44 checks](pr44-review-gate.json).

Media stays local and untracked. Do not run the old export script to prepare a public version: it regenerates the restricted Samantha voice and overwrites original artifacts.

## PR #44 and synchronization

Reviewed the documentation and structured evidence in the 13-file change: release documentation, public observations, controls, manifest, validation inventory and screenshots. The changes are documentation/evidence only. The recorded public release identity and offline status were independently confirmed; the metrics in the written report agree with its saved receipts. There were no submitted reviews, PR comments or inline review threads, and no blocking findings from this review.

Waited for **all four GitHub checks to pass** on `33c5c25d1b67b0e9acf9c3dc89924c08eba756af`: both `verify` and both `cloudflare` checks across the push and PR runs. Then squash-merged [PR #44](https://github.com/jbellamy16/second-look/pull/44) with an exact-head guard at **21:58:31 UTC**. Merge commit: `cc1344d2da341db9db25252e32d034b905bee5c7`.

Fetched origin, fast-forwarded the local `main` reference to `origin/main`, and based this publication branch on that commit in a separate worktree. The original `codex/bounded-evidence-discovery` checkout, its local commit, modified `next-env.d.ts`, other worktrees and existing artifacts remain intact. All 267 frozen source and 109 historical digests verify using the existing UTF-8 hash convention, and their raw bytes also match the base commit. The manifest and original evaluations were not regenerated. This publication documentation PR must remain unmerged.

## Media verification

Original SHA-256: `befaee11e9a2cc9336fda61dcced02b62e483a8b35fb4ee572c16f3ccda9301a`, matching the original media receipt.

- Full-file decode succeeded: **116.000 seconds**, **3,480 frames**, **1920 × 1080**, **30 fps**, H.264 High/yuv420p, 16:9.
- Original audio is **AAC, 48 kHz, mono**; measured mean **−16.1 dB**, peak **−1.5 dBFS**, with no decode errors. These are technical checks, not a claim of human listening review.
- **25 English cues**, ordered and non-overlapping, ending at **114.970 seconds**. Exact scene-text match; maximum reading rate approximately **17.2 characters/second**. The original timing is proportional within speech segments, not word-level alignment. Some cues have three lines and one short cue lasts 0.779 seconds; retain owner presentation review as a limitation.
- Captions are burned into a dedicated band below the app. SRT/VTT files provide a selectable upload track ([YouTube upload guidance](https://support.google.com/youtube/answer/2734796?hl=en)); the MP4 itself has no selectable subtitle stream. Platform CC may duplicate burned-in text and should be checked after upload.
- Visually reviewed the full-timeline contact sheet and full-resolution fading-answer and Foundry-result frames. Source labels and key limitations remain readable. The silent derivative copies the video stream, removes the audio stream, and preserves the decoded video-frame hash.
- Human listening/presentation review of the original remains unreported. The original audio is not an approved publication asset regardless of its technical quality.

## Public application comparison and factual review

The public [/release.json](https://between-the-lines-jb-f5539b65.azurewebsites.net/release.json) identifies commit `10cd0aa68c4f1fab07aef2b244992c46879f44c7`, build `dU8AxOcHi3KhXUbI-NhT3`. The public `/api/insights` returned `mode: offline`, `configured: offline`, `proactive: false`. PR #44 is documentation-only, so its merge does not require a new app deployment.

An actual browser walkthrough on the public origin independently verified the following. No provider mode was enabled, no response was mocked, and no inference endpoint was called by this work.

| Recording | Observed deployed behavior                                                                                                                                         | Finding                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 0–22s     | At 63:24, Harbor lead 1–0. Shots are 0 → 4 across equal 9m12s spells. More attempts do not establish better chances.                                               | Matches                                           |
| 22–38s    | Casual Viewer, Football Fan and Advanced Analysis all work, each with Quick and Full recap. All six retain 63:24 and the shared shot counts and qualifications.    | Matches                                           |
| 38–53s    | Shot-surge question says no single explanation is established. Table shows shots 0 → 4 and all three other measures 0 → 0; provenance says No model investigation. | Matches                                           |
| 53–69s    | At 70:00, wider shots rise 1 → 4, while current-window halves fall 3 → 1. The answer explicitly says this does not predict the next outcome.                       | Matches                                           |
| 69–82s    | Answer evidence opens; 59:09 shot replays six synthetic actions from 58:39 to 59:09 at 8×. Replay reaches completion while the main clock remains 70:00.           | Matches                                           |
| 82–94s    | Separate implementation card describes optional structured selection/bounded evidence queries and application computation/checking.                                | Accurate implementation boundary; not a live call |
| 94–108s   | Historical card reports five completed answers matching baselines, one appropriate no-call and zero optional follow-ups.                                           | Original receipt hash and results verified        |
| 108–116s  | Current catch-up remains available; AI stays off. No reported participant study establishes improved comprehension.                                                | Claims remain appropriately limited               |

The recording was made locally before the current deployment, and is still correctly labeled **LOCAL PREVIEW**. Today's layout includes later editorial presentation changes, so this is behavioral parity, not a claim of pixel-identical footage or a capture made on Azure. The description explicitly identifies that distinction. Older demo-package statements that the public host has only two levels are superseded by the [October 12 release record](../release-2026-10-12/RELEASE.md); historical recording/evaluation files remain untouched.

Foundry's actual historical role was model selection over application-retrieved evidence, with controlled rendering after application checks. The original [results](../intelligence/guided-foundry-2026-10-11/results.json) hash matches the [card provenance](../demo-2026-10-12/assets/foundry-provenance.json). Five responses were completed; the unavailable-quality case abstained without a provider call. No optional follow-up tools were selected. Added investigative benefit, general reliability and better viewer understanding remain unproven. The demo does not claim Foundry Agent Service, autonomous orchestration, learned personalization, tracking or live football coverage.

## Asset and competition review

The [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md), checked October 12, require a functioning demo under two minutes, a public video URL, a public GitHub repository, English materials, and rights to included assets (§4.4–4.11). They also grant organizers broad reuse rights (§7), so a personal-use audio license is insufficient. GitHub reports this repository as public; 116 seconds meets the duration limit. No match footage, music or real-player likenesses were found in the reviewed video.

| Asset                                                  | Evidence and publication assessment                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samantha system-voice narration                        | Export script explicitly uses `say -v Samantha`; host runs macOS Tahoe 26.6.2. [Apple's Tahoe license §2F](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf) restricts system-voice use to personal, noncommercial projects and excludes public sharing. **Do not publish the original audio absent separate permission.** The silent derivative removes this asset entirely. |
| Synthetic events, pitch and Between the Lines identity | Project-authored assets described in the brand/data-rights documentation. No licensed match feed or broadcast footage appears.                                                                                                                                                                                                                                                   |
| Harbor/Riverside crests                                | [Asset inventory](../brand/VISUAL-ASSETS.md#licenses-and-provenance) identifies supplied fictional-club artwork; it does not contain the owner's underlying rights grant. **Owner confirmation of public/competition reuse rights remains needed.** Fictional names alone do not establish ownership.                                                                            |
| Inter and Barlow Condensed                             | SIL Open Font License notices retained in `docs/brand/`.                                                                                                                                                                                                                                                                                                                         |
| Lucide/Feather UI icons                                | ISC/MIT notices retained in `public/icon-licenses.txt` and linked from the description.                                                                                                                                                                                                                                                                                          |
| Arial in cards/caption rendering                       | Rasterized type, no font file distributed with the video. Apple's §2E permits use of included fonts to display/print content; the separate system-voice restriction remains decisive.                                                                                                                                                                                            |
| Foundry/Microsoft/model names                          | Plain-text factual identification of the integration required by the competition story; no third-party logo or endorsement claim added. Final entry representations remain the owner's responsibility.                                                                                                                                                                           |

This is an evidence-based publication review, not a blanket certification of intellectual-property ownership. The voice restriction and absent crest rights confirmation prevent declaring every original asset cleared.

## Publication handoff and remaining blockers

1. Choose the silent derivative or supply a recording of the timed script with public and competition reuse rights. A new narration requires fresh media/caption verification.
2. Confirm ownership/permission for the two supplied crests covering public upload and competition reuse.
3. Create or select a YouTube channel in the authenticated account. The observed Create channel flow requires terms acceptance; it was not completed.
4. Explicitly approve the exact video file, target channel, Public visibility, title and description before any upload/publication. Approval has **not** been given. No scheduled upload or draft upload exists.
5. After authorization, upload the chosen video and English SRT **with timing**, complete the owner's audience/disclosure settings accurately, wait for HD processing and verify the final watch URL in a fresh signed-out browser: no login wall; playback and seeking from beginning to end; 1:56 duration; 1080p availability; readable captions with CC on/off; correct title/description and working app/repository links. Record the URL, video ID, selected file hash, channel and verification timestamp here and in `docs/SUBMISSION.md`.
6. Authenticated hackathon entry fields/category and final owner representations remain unreviewed; nothing has been submitted. Maintain free project access through judging. Human viewer benefit and additional Foundry value remain unmeasured, not reasons to enable inference.

**Final public video URL: not published.** Post-publication access, captions and playback cannot be verified until an authorized upload exists.
