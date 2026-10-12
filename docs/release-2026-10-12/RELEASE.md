# Verified public Azure release — October 12, 2026

**Public app:** [Between the Lines](https://between-the-lines-jb-f5539b65.azurewebsites.net/).

**Deployed commit:** `10cd0aa68c4f1fab07aef2b244992c46879f44c7` ([PR #43 merge](https://github.com/jbellamy16/second-look/pull/43)). **Build:** `dU8AxOcHi3KhXUbI-NhT3`, confirmed on the actual public [/release.json](https://between-the-lines-jb-f5539b65.azurewebsites.net/release.json).

**Unmocked signed-out walkthrough verified:** October 12, **4:47:01 p.m. America/Chicago** (21:47:01 UTC). The deployed app reproduces the current hackathon demonstration's three explanation levels, shot-surge comparison, guided deterministic answers, checkpoints, evidence inspection and pitch replay. It also includes the merged equal-chance-quality correction. The older deployment-parity warnings in the readiness audit and recording walkthrough are superseded by this record.

## Review and release provenance

Reviewed PR #43 at exact head `dde92435dee44cf8e461851bb81d5f69ae19d03c`: the complete new evaluation modules and entry scripts, authorization and accounting gates, offline mocks, frozen inventory, tests and documentation. No blocking review findings or unresolved GitHub review threads remained. The diff changes no application source, B2 implementation, package dependencies or CI workflow. All four GitHub checks passed before the guarded merge at 21:44:59 UTC: [push run](https://github.com/jbellamy16/second-look/actions/runs/38311378314) and [PR run](https://github.com/jbellamy16/second-look/actions/runs/38311418762). [Saved check gate](pr43-review-gate.json).

The push Cloudflare job initially failed the existing mobile rewind test: the first slider action left the page at 63:24. That test does not wait for hydration before manipulating the slider. The equivalent PR job passed; 15 additional local repetitions across all three browser projects passed, and the failed job's rerun passed without changing any frozen source. The initial failure is retained in GitHub's run history. It is an intermittent test-timing limitation, not a reason to silently omit a check.

Fetched origin and created the release branch from latest `origin/main` in an isolated worktree. The merged tree is byte-identical to the reviewed head. The original `codex/bounded-evidence-discovery` checkout, its local commit and modified `next-env.d.ts`, other worktrees and existing artifacts were preserved.

The production build used a lockfile installation without local environment files, the Azure canonical URL and explicitly disabled AI/synthetic-only flags. Next.js standalone packaging followed the [existing runbook](../DEPLOYMENT.md); both Linux x64 Sharp packages were verified against lockfile SHA-512 integrity. The ZIP was scanned for environment files, key filenames, private-key/token patterns and unintended evaluation/documentation directories. No credentials were copied. Local Node 26.8.2 is within the repository's supported range; Azure remains Linux Node 24 LTS.

- Azure deployment: `ca76023a-b9db-4776-a602-4e5f71444000`, **RuntimeSuccessful**, one successful instance, zero failed instances.
- Package: `azure-release-10cd0aa6.zip`, **25,375,336 bytes**.
- ZIP SHA-256: `b4e894f2cb4171b49e644aab79a798bdaf5e4e3b396e6319d8eda5fcf5aa0ab3`.
- [Artifact manifest and build flags](release-manifest.json). Release identity was written inside the packaged standalone artifact and is independent of mutable runtime settings.
- Deployment used the existing authenticated Azure CLI, with clean extraction and restart. No infrastructure was provisioned, GitHub publish-profile workflow invoked, or basic publishing authentication enabled.

## Actual public verification

[Saved unmocked observations](public-verification.json) come from fresh signed-out Chromium contexts at **1600×1000, 390×844 and 360×844**, with no response interception. Each verified:

- Initial **63:24**, Harbor **1–0**, synthetic source, and no Recorded navigation.
- **Casual Viewer, Football Fan and Advanced Analysis**, each with Quick and Full recap: all six combinations retain the cutoff and facts.
- **What best describes this shot surge?** returns **No single explanation is established by these events**. Compared shots are **0 → 4**; recovery-to-shot actions, linked spells and opponent shots are **0 → 0**. The answer retains source limitations and **No model investigation**. Chance-quality comparison is unavailable at 63:24 because the earlier window has no shots.
- The opponent question returns deterministic evidence while preserving the selected story.
- At **70:00**, **Has this increase already faded?** correctly answers yes: wider shots **1 → 4** across 45:00–57:30 and 57:30–70:00, with recent halves **3 → 1** across 57:30–63:45 and 63:45–70:00. Advanced Analysis exposes the precise comparison windows; Casual Viewer explains the same facts in everyday wording.
- **Explore answer evidence → 59:09 · shot · Replay → Restart replay** completes the six-action synthetic passage. The main match clock stays **70:00**. Replay visualizes recorded endpoints, not continuous tracking or match footage.
- Rewind restores **0–0**, clears the later answer and excludes the later goal from the kickoff recap.
- No horizontal overflow, no page/console errors, no failed browser responses, no browser provider requests and **zero UI POST requests**. Automated axe WCAG A/AA checks pass on the shot-surge view.
- All four historical GETs return **404**; historical Director and narration POSTs return **404**; a historical payload to the synthetic recap endpoint returns **400**. These validation requests are separate from the zero-POST UI walkthrough.

Desktop and mobile captures were visually inspected for readable controls, replay completion and responsive layout: [desktop](screenshots/desktop.png), [shot surge](screenshots/shot-surge.png), [mobile answer](screenshots/mobile-answer.png), [mobile replay](screenshots/mobile-replay.png). The fixed mobile navigation stays at the viewport bottom; the longer evidence panel remains scrollable.

## Test results

[Machine-readable validation and public test inventory](validation.json): type checking, **850 unit tests** and the production build passed; **11 optional environment-dependent unit cases** skipped locally. The tested PR head and merged application tree are identical. **45 focused local production-browser checks** passed, with six hidden-source skips; **15 additional rewind repetitions** passed.

The actual public URL passed **93 browser checks**, with **six recorded-source UI checks intentionally skipped** because access is disabled, and no failures or retries. Coverage includes all levels/lengths, guided questions, shot-surge determinism, navigation, favorite/preferences persistence, rewind, keyboard/touch controls, focus/disclosure behavior, light/dark and responsive layouts, axe WCAG A/AA audits, API validation and metadata assets. Some existing browser tests intercept provider labels and responses to exercise cancellation/recovery; those results do not establish live AI performance. The separate unmocked walkthrough above uses no response interception.

## Controls and candidate preservation

[Before/after Azure verification](azure-controls.json) confirms every App Service setting is unchanged, using a digest of the full settings list without publishing secrets. Public status remains `mode: offline`, `configured: offline`, `proactive: false`.

- `AI_ENABLED=false`, `FOUNDRY_ENABLED=false`, `AI_PROACTIVE_ENABLED=false`; minute/hour/day/total quotas **0**.
- `HISTORICAL_MATCHES_ENABLED=false`, `RECORDED_MATCHES_VISIBLE=false`, at build and runtime.
- Free **F1**, HTTPS-only, minimum TLS 1.2, FTP disabled, basic publishing authentication disabled, Node 24 and `node server.js` startup preserved.
- Foundry deployment/model/capacity/limits unchanged: GlobalStandard GPT-5.4 Mini, **30 RPM / 30,000 TPM**. No Redis operation, model request, allowance initialization, quota reset or spending-control change occurred.
- PR #43's candidate remains `c1e06e3a397bada88b59958ef41b217cd0141fdab62e11eaa115d58d10d05496`. Its **267 source hashes and 109 historical-artifact hashes** verify unchanged. No freeze regeneration, new authorization or live evaluation was performed. B2 is unchanged. The documentation PR stays outside the frozen source/historical-artifact inventories.

## Rollback

The immediately preceding verified release remains available: commit `2014a497c84c799952c218a0229ec0c16bd964b1`, build `5RQmQSiNYhdr5N2vAfUbm`, deployment `4d102384-bafe-4d4b-98f1-a71c22bbdad3`. Its ZIP is retained in the original checkout at `artifacts/final-release-2026-10-11/azure-release-2014a497.zip`; its SHA-256 was reverified as `f90bfc29a4d6baebd2898455f93dd6e9ae82683888231ad301dfbeee3f7abfc9`.

From the original checkout, the existing authenticated CLI can restore it:

```sh
az webapp deploy --subscription f5539b65-3db7-428e-a605-e4c0763c1c5d --resource-group rg-between-the-lines --name between-the-lines-jb-f5539b65 --src-path artifacts/final-release-2026-10-11/azure-release-2014a497.zip --type zip --clean true --restart true --timeout 600000
```

Keep all current controls unchanged. Recheck `/release.json` for `2014a497`, offline status, historical rejection, initial score/clock, recap and rewind. This older build has only two styles and would reopen demo parity as a blocker. Rollback was prepared, not exercised, because the new release verified successfully. The new verified ZIP is also retained under `artifacts/release-2026-10-12/` in both the release worktree and original checkout.

## Remaining submission blockers and limits

1. **Public video URL:** the current 116-second video remains local and unpublished. Owner review and explicit publication authorization are still needed, followed by signed-out playback/caption/duration checks.
2. **Authenticated final-entry review:** portal fields, category choice, rights and final representations still need owner review. Registration/eligibility were owner-confirmed in the readiness audit; no entry has been submitted.
3. **Continued public access:** this verifies a point in time, not an uptime guarantee. Existing Free F1 capacity and spending controls remain unchanged; no monitor or upgrade was added.

Physical Safari/mobile hardware and manual screen-reader certification remain untested. Automated accessibility and Chromium touch-size checks are not substitutes for those. Viewer testing still has zero reported participant sessions; improved comprehension and added Foundry value remain unproven. The frozen live evaluation remains blocked pending its separate authorization and durable-accounting prerequisites. Those are evidence limitations, not reasons to enable public inference for this release.
