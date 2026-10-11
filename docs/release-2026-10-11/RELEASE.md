# Verified public release — October 11, 2026

**Application:** https://between-the-lines-jb-f5539b65.azurewebsites.net/

**Product commit:** `2014a497c84c799952c218a0229ec0c16bd964b1` ([PR #26](https://github.com/jbellamy16/second-look/pull/26), merge commit).

**Identity:** [/release.json](https://between-the-lines-jb-f5539b65.azurewebsites.net/release.json), build `5RQmQSiNYhdr5N2vAfUbm`.

**Public walkthrough verified:** October 11, **2:10:47 p.m. America/Chicago** (19:10:47 UTC). Upload completion alone was not treated as release verification.

## Review and deployment

Reviewed PR #26's current diff, guided evidence calculations, source/cutoff checks, cache identity, request cancellation, final race fix and browser coverage. No blocking product defect or review comment remained. All four checks on final head `1ac87066c039c802ad6226f0830b00ccddca5fdf` passed. Marked ready and merged with the repository's merge-commit method at 19:03:58 UTC. The merged product's [verify and Cloudflare checks](https://github.com/jbellamy16/second-look/actions/runs/38166436355) also passed. Cloudflare was not deployed or reconfigured.

Built from a clean isolated worktree at the identified commit, after `npm ci`, without local environment files. Type checking and production build passed. Local Node was 26.8.2 (within the repository's supported 22–26 range); CI and Azure use Node 24. The two Linux x64 Sharp packages were selected from the lockfile and their SHA-512 integrity verified. The standalone package excludes environment files and keys. Its non-sensitive `public/release.json` was generated during packaging and travels with the compiled artifact, rather than relying on a mutable runtime commit setting.

- ZIP SHA-256: `f90bfc29a4d6baebd2898455f93dd6e9ae82683888231ad301dfbeee3f7abfc9`.
- Package: **25,360,488 bytes**, [manifest](release-manifest.json).
- Azure deployment: `4d102384-bafe-4d4b-98f1-a71c22bbdad3`; upload finished **19:07:45 UTC**, then CLI confirmed `RuntimeSuccessful` with one successful instance and no failed instances.
- Deployment used the existing signed-in Azure CLI, a prebuilt ZIP and clean extraction. Basic publishing authentication remains disabled; the publish-profile GitHub workflow was not used.
- Preserved Free F1, HTTPS-only, minimum TLS 1.2, FTP disabled, Linux Node 24 and `node server.js` startup.
- Preserved `AI_ENABLED=false`, `FOUNDRY_ENABLED=false`, `AI_PROACTIVE_ENABLED=false`, and minute/hour/day/total limits **0**. Foundry remains selected but inactive, at **30 RPM / 30,000 TPM**.
- Only runtime configuration changes: explicitly set `HISTORICAL_MATCHES_ENABLED=false` and `RECORDED_MATCHES_VISIBLE=false`; these were also set for the build.

The original checkout's generated `next-env.d.ts`, existing worktrees, evaluation receipts, durable counters and stopped study services were preserved. No new model call, paid resource, hosting upgrade, counter reset, reviewer outreach, video publication or competition submission occurred.

## Public verification

[Machine-readable observations](public-verification.json) record fresh signed-out Chromium contexts at **1600×1000**, **390×844**, and **360×844**, with no response interception. Each passed:

- Initial 1–0, 63:24 and a meaningful shots story; quality question correctly unavailable at the initial cutoff.
- All four Plain English / Football Analysis × Quick / Full combinations, preserving cutoff and facts.
- Opponent and fading questions, direct answers, material qualifications, source-window evidence and the 59:09 replay.
- Main clock remains 70:00 during replay; rewind clears the later answer, restores 0–0 and excludes the later goal from Catch Me Up.
- No recorded-match navigation; all four historical GET endpoints return 404. Historical Director/narration requests return 404; the synthetic recap endpoint rejects a historical-source payload with 400.
- **Zero UI POST requests**, zero browser provider requests, zero page/console errors and no horizontal overflow. Server status is `mode: offline`, `configured: offline`, `proactive: false`; hosted settings independently confirm the disabled flags and zero quotas.

Broader deployed-URL checks passed **69 checks** across navigation, favorites, replay, recaps, styles, keyboard/touch interaction, modal focus, axe WCAG A/AA checks and metadata. **Six historical-UI checks were intentionally skipped** because recorded matches are disabled. The initial guided run passed 15 checks but exposed three test-teardown errors: an aborted mock's offline fixture fetch could outlive a test over the public network. A narrow `unrouteAll` cleanup fixes that harness issue. The final guided rerun passed **all 18 checks**, including the three initially unrun checks. Thus **87 distinct public browser checks passed** across the completed runs. Intercepted provider labels/delays are test controls only; they do not establish live AI quality. Actual unmocked walkthrough and video results are recorded separately above.

Local release checks: **524 unit tests passed, six optional tests skipped**, type checking and build passed, then **21 focused production-browser checks passed**. An initial local unit invocation incorrectly applied production quota/source flags to mocked-provider tests; rerunning unit tests with their expected test configuration passed. Production build/runtime restrictions remained enabled throughout. The merged commit's CI additionally covers the Redis fixtures and full production browser suite.

## Screenshots

- [Desktop initial release](screenshots/desktop.png)
- [Mobile initial release](screenshots/mobile.png)
- [Mobile guided answer](screenshots/mobile-answer.png)
- [Supporting-event replay](screenshots/replay.png)

These are actual public-app captures, not mockups. The fixed mobile navigation bar appears at the viewport boundary in full-page captures; content scrolls beneath it and remains reachable.

## Demo and submission

A real **113-second** recording of the public release is complete with neutral synthetic narration, burned-in captions, SRT/WebVTT and a timed script. The recording made zero POST requests. It states the synthetic/offline source, Foundry's optional role, the matching-baseline result and pending human validation. See [demo assets and publication instructions](../intelligence/DEMO.md), [submission package](../SUBMISSION.md), and [viewer protocol](VIEWER-TEST.md). Video files remain local and untracked.

Guided historical evaluation is unchanged: **five verified model answers, one correct no-call, US$0.01632525**. Every model answer matched the deterministic baseline; no additional investigative benefit was demonstrated. The later cancellation fix is supported by offline/browser validation, not a rerun of the paid study.

## Rollback and limitations

Previous successful deployment: `2b23c9c2-f5be-450c-8a8b-7a3685b6ab73`, product commit `687e658b82758f698548b4758db2e070a1840530`, build `pJCpdcp3wBsO-9dndiFKv`. Its existing local ZIP remains at `artifacts/release-2026-10-11/azure-release.zip` in the original checkout. Verified SHA-256: `40a2d1265ef83546af52763686a494bd3ce76732e1d885b6bb4ea9b14e436947`.

If rollback is needed, deploy that verified ZIP with the same signed-in CLI command in [the runbook](../DEPLOYMENT.md), retaining the current synthetic-only flags and zero inference quotas. Then repeat public status, initial score/clock, recap and rewind checks. The older artifact lacks the new release identifier and guided experience. This release verified successfully, so rollback was not exercised.

No blocking product defect was found in the covered flows. Remaining limits: no physical Safari-device or manual screen-reader certification; no real participant feedback; no broad real-match reliability claim; free-tier hosting has limited capacity and no uptime SLA. Authenticated portal fields/registration are unverified. Video is local, not published, and the entry is not submitted. The challenge's AI/category fit is for the owner and judges to assess; the public release does not demonstrate live inference.
