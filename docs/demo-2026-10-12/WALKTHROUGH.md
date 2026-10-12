# Judge walkthrough and recording setup

Use the application from this PR, based on merged main `f19995e8d50f5bf18fdd166f69c961a5727fcc8b`. Application code is unchanged by the demonstration update. The older Azure release `2014a497` has only two explanation styles; it is not the build in this recording. Do not substitute it silently. No login, service key or paid model call is needed locally.

## Start the offline production preview

Use the repository's supported Node version (Node 24 recommended), then run from the repository root:

```sh
npm ci
AI_ENABLED=false AI_PROVIDER=offline FOUNDRY_ENABLED=false AI_PROACTIVE_ENABLED=false HISTORICAL_MATCHES_ENABLED=false RECORDED_MATCHES_VISIBLE=false npm run build
AI_ENABLED=false AI_PROVIDER=offline FOUNDRY_ENABLED=false AI_PROACTIVE_ENABLED=false AI_MINUTE_LIMIT=0 AI_HOURLY_LIMIT=0 AI_DAILY_LIMIT=0 AI_TOTAL_LIMIT=0 HISTORICAL_MATCHES_ENABLED=false RECORDED_MATCHES_VISIBLE=false PORT=3124 HOSTNAME=127.0.0.1 npm start
```

Use a free port if 3124 is occupied; preserve others' servers. Open `http://127.0.0.1:3124` in a fresh private browser session. `/api/insights` must report `mode: "offline"` and `proactive: false`. The current interface must offer **Casual Viewer**, **Football Fan**, and **Advanced Analysis**. Process flags override local configuration without editing `.env.local`; no model credentials are required. Keep the server open for the walkthrough.

## Exact controls and checkpoints

1. **Reset.** In Settings, select **Generator profile → Curated demo (default)**, then **Reset demo**. It closes Settings. Confirm **The pressure builds**, Harbor **1–0** Riverside, paused at **63:24**. The seed is **202632**; there is no seed field to fill. Keep neutral team/player preferences and all categories enabled. Set the main story's **Explanation level → Casual Viewer** explicitly, because Reset demo preserves this preference.
2. **Read the development.** Show **What changed**: four shots in **54:12–63:24**, after zero in **45:00–54:12**, two equal **9m12s** spells. None of those four scored. **Why it matters** says more shots need not mean better chances. The quality question is unavailable because there were no earlier shots; this is not a claim of lower quality.
3. **Personalize.** Open **Catch me up**. Starting in **Quick recap**, choose Casual Viewer, Football Fan, then Advanced Analysis. Casual uses everyday wording; Fan names verified contributions; Advanced adds precise comparisons. Select **Full recap** while keeping Advanced Analysis. Restore Casual Viewer and Quick, then close with Escape. The levels share checked facts and limitations; Quick/Full changes recap breadth separately. These controls do not call a model.
4. **Investigate.** Under **Look closer**, select **What best describes this shot surge?**. Read **No single explanation is established by these events**. The table shows shots **0 → 4**, shots after qualifying near-goal ball wins **0 → 0**, separate linked spells **0 → 0**, and opponent shots **0 → 0**. Candidate explanations are **Not established**. Scroll to **What limits this reading**. Missing links do not prove a different attacking route; recorded sequence does not establish cause. Keep **Verified event analysis / No model investigation** visible.
5. **Advance the story.** Keep playback paused. Drag **Match timeline** near 70:00, then use left/right arrow keys for one-second adjustments. Verify both the main clock and story cutoff say **70:00**. This is an explicit time jump, not continuous match playback. The recording tool sets the same slider to 4200 seconds through its normal input events; no fixture or response is injected.
6. **Ask if it faded.** Select **Has this increase already faded?**. The answer is **Yes, the increase has eased in the latest half of this spell**. Wider equal **12m30s** spells (**45:00–57:30**, **57:30–70:00**) show **1 → 4** shots. The current spell's equal **6m15s** halves (**57:30–63:45**, **63:45–70:00**) show **3 → 1**. A recent slowdown can coexist with the wider increase and does not predict the next goal.
7. **Inspect and replay.** Expand **Explore answer evidence** and choose **59:09 · shot · Replay**. The passage contains six recorded synthetic actions, **58:39–59:09**, played at **8×**. Use **Restart replay** once the pitch is visible so the whole movement is seen. Main match time stays at **70:00**. The pitch shows recorded endpoints; it does not show continuous tracking, off-ball movement or broadcast footage. This passage illustrates one event, not the entire aggregate comparison.
8. **Explain Foundry separately.** At 82 seconds show [the architecture card](assets/foundry-role.png), then at 94 seconds [the historical result card](assets/foundry-receipt.png). The latter is derived from the October 11 receipts at evaluated commit `b560900`; it is not a response from today's local build. Return to the current catch-up summary at 108 seconds and finish at 116.

## Reproduce supporting assets and video

Install Chromium once with `npx playwright install chromium`. With the offline server running:

```sh
node scripts/demo/cards.mjs
DEMO_URL=http://127.0.0.1:3124 node scripts/demo/record.mjs
FFMPEG=/absolute/path/to/ffmpeg python3 scripts/demo/export.py
```

The export requires macOS's installed Samantha voice (`say`) and an installed FFmpeg build with `libass`, `drawtext` and H.264. It does not download tools, contact a speech service or call a model. Use your installed FFmpeg path; do not commit the executable. The capture refuses non-local URLs, checks offline mode, validates the on-screen checkpoints, records all POST requests and browser exceptions, and fails on missed action cues. Run capture to completion before export. These commands overwrite only this revision's derived assets, not historical receipts.

The edit trims initial loading, adds captions/source labels, magnifies the actual recorded question frames, and inserts the two clearly labeled cards. No application facts are edited. The SRT and WebVTT use text chunks timed proportionally within measured speech segments, not word-level forced alignment. Review the final export end to end after any script change. The four-second margin below two minutes must survive any later title, logo or publishing edits.

If a checkpoint or source label differs, stop the take and diagnose the mismatch. Do not replace a failed answer with historical output, hide a provider failure, enable inference or reuse an old study allowance for the recording.
