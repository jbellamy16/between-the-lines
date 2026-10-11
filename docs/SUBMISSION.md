# Between the Lines — submission preparation

## Project pitch

**More than the score.** Between the Lines turns a synthetic football match into evidence-linked explanations of what is changing, why it matters and what to watch next. A viewer can inspect the underlying events, replay a passage and follow a storyline as it emerges, weakens or resolves.

The application is an individual entry for Microsoft’s Inside the Game Hackathon. Its official demonstration uses fictional Harbor Athletic and Riverside FC, original branding and project-owned synthetic events. Historical data adapters remain separate and subject to [source rights](DATA-RIGHTS.md).

## What the current release candidate demonstrates

- Canonical events and one playback cutoff gate every observation and comparison.
- Microsoft Foundry’s Responses adapter supports model-selected follow-up questions through eight bounded evidence tools, including selective counter-evidence inspection.
- Deterministic verification reproduces claims, identities, windows and measurements before publishing a story. The model cannot approve its own claims or write arbitrary factual prose.
- Structured hypotheses distinguish recorded observations, cautious interpretations, contradictory evidence and missing information.
- Stable storylines reconstruct from completed five-minute windows; rewinding removes later developments.
- A versioned broadcast story carries the explanation, measurable next check, evidence graph, source provenance, visualization and presentation timing.
- The existing detailed match interface presents the essential explanation and progressively discloses measurements, counter-evidence, replay and export.

See the [architecture, audit and evaluation](intelligence/EVOLUTION.md), [frozen original comparison](intelligence/original-baseline.json) and [100-second demonstration script](intelligence/DEMO.md).

## Microsoft technology and verification status

**Microsoft Foundry:** the existing Azure OpenAI Responses adapter uses server-side resource-key authentication and the configured GPT-5.4 Mini deployment. The model chooses bounded investigations and an editorial plan. Event calculations, factual language, temporal reconstruction and verification run in application code. Earlier versions completed authorized live tests; the new Director 1.2 extension has offline and scripted-provider validation only. See [actual Foundry results and the integration update](FOUNDRY-EVALUATION.md) and the [earlier model comparison](EDITORIAL-MODEL-COMPARISON.md).

**Azure App Service:** an earlier application version was deployed and independently checked as recorded in [deployment history](DEPLOYMENT.md). This pull request has not been deployed. A public site’s existence does not establish that it contains these changes or runs live AI.

**GitHub:** source, pull requests, unit/evaluation/browser checks and manual deployment workflows. No managed identity, Foundry Agent Service, Agent Framework migration, Fabric, Copilot integration or autonomous multi-agent runtime is claimed.

Inference remains disabled by default. Existing fail-closed Redis controls, quotas and source restrictions are preserved. A new live evaluation requires a specific owner-authorized request/spending allowance; no new paid resource or public inference enablement is part of this work.

## Reproducible recording

Use the unchanged pressure fixture, demo profile, seed 202632. Start paused at 63:24. At 65:00 the Harbor advanced-recovery storyline emerges with three recoveries against one in the preceding five minutes. At 70:00 it weakens with one; at 75:00 it resolves with zero. Rewind to 65:00 to show that the later resolution disappears. These are recorded-event thresholds, not proof of pressing intensity.

Follow the [complete 100-second screen flow and narration](intelligence/DEMO.md). Keep **Deterministic offline** visible in an offline recording. Only show real Foundry investigation activity after an authorized request succeeds. A replay of a saved result must say “Recorded verified Foundry investigation” and identify its version/cutoff. Do not use an older evaluation receipt to validate this version.

## Submission checklist

- Verify eligibility, registration, current deadlines and deliverable requirements against the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md) and submission portal before entering. This implementation did not revalidate competition dates or submit an entry.
- Complete blinded football relevance and broadcast usefulness review; automated factual checks are not proof of editorial superiority.
- With a separately authorized bounded allowance, evaluate the revised Foundry workflow and record actual costs, failures, latency and reviewer preference.
- Obtain approval to merge and deploy; independently verify the intended version on the public URL afterward.
- Review the final recording on desktop and mobile. Browser tests use Chromium touch/viewport emulation, not certification on physical iPhones or Safari.
- Produce the video, public repository link, application URL, project pitch and accurate Microsoft technology statement. Obtain approval before publishing or submitting.
- Retain original brand/data attribution, dependency licenses and source restrictions. Include no unlicensed league marks, club crests, footage, photographs or music.

## Suggested profile copy

**Project name:** Between the Lines

**Tagline:** More than the score.

**Short description:** Football insights viewers can understand, question and replay. Between the Lines connects recorded actions to meaningful changes, explains the limits of the evidence and follows match stories over time.

**Technology statement:** Next.js, React, TypeScript and an interactive SVG pitch, with deterministic event analysis, independently verified hypotheses, temporal storylines, a typed evidence graph and an optional Microsoft Foundry Responses investigation workflow. The synthetic demo works offline. Live provider quality and production readiness are reported separately from automated verification.

Use the [video title graphic](../public/brand/video-title.png) and [brand guidelines](brand/README.md). The GitHub repository remains `jbellamy16/second-look`. No submission, account change or video publication was performed.
