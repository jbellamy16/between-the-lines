# Between the Lines — submission preparation

Prepared October 11, 2026 (America/Chicago), from PR #23 merge `fb108863dae6a69a7af0df0101ca1fbc66ab4be1`. These materials have not been deployed, published as a video, or submitted.

## Project pitch

**More than the score.** Joining a football match late should not mean deciphering a wall of statistics. Between the Lines gives viewers a clear explanation of what is changing, a Catch Me Up briefing, and the recorded actions behind every story. Plain English and Football Analysis explain the same checked facts at different levels of detail. Viewers can replay a supporting passage and see an interpretation weaken as new events arrive. Optional Microsoft Foundry investigations select from independently verified evidence; application code controls calculations, qualifications and factual wording.

**Entry:** individual, subject to owner eligibility/registration confirmation. **Proposed categories:** overall; Best Use of Microsoft Foundry. No multi-agent or enterprise-readiness claim. The official demo uses fictional Harbor Athletic and Riverside FC and project-owned synthetic events. Historical adapters are hidden in this demo and subject to [source rights](DATA-RIGHTS.md).

## Rules and portal check

Checked October 11 against the [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md), sections 1, 4 and 6:

- Registration closes **October 20, noon Pacific / 2 p.m. Chicago**.
- Submission closes **October 27, 11:59 p.m. Pacific / October 28, 1:59 a.m. Chicago**.
- Keep judging access available through **November 10, 11:59 p.m. Pacific / November 11, 1:59 a.m. Chicago**.
- Supply an English pitch, public GitHub repository, unrestricted free working demo/test build and public video URL. Video must be **under two minutes**, show functioning software and use authorized materials. Listed hosts include YouTube and Vimeo.
- Use synthetic football data; confirm eligibility, original ownership, licenses and creation after registration opened September 29.

The [official entry link](https://aka.ms/insidethegame) redirects to the [Innovation Studio portal](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon). Read-only inspection reached Microsoft authentication, requiring owner sign-in. Registration, account eligibility, authenticated Projects fields, field limits and additional portal requirements **could not be verified**. No form was submitted. The owner must check these before entry; the rules' overlapping judging/submission dates are not reinterpreted here.

## Microsoft technology statement

| Component | Implemented responsibility | Evidence and limit |
| --- | --- | --- |
| Microsoft Foundry, Azure OpenAI Responses endpoint | Server-side resource-key authentication routes to the configured deployment. After required application retrieval, the model can choose bounded follow-up evidence queries and submit structured claim selections. | [Current investigation design](intelligence/foundry-efficiency-2026-10-11/REPORT.md), [runner](../src/lib/ai/director/runner.ts), [adapter](../src/lib/ai/providers.ts). Director `1.4.0` has offline/scripted validation; no current live result claimed. |
| Application TypeScript | Generates events, applies the playback cutoff, calculates counts/windows/score, assesses counter-evidence and storylines, replays queries in an independent verifier, and renders controlled factual wording. | [Hypothesis checks](../src/lib/ai/director/hypothesis.ts), [story packaging](../src/lib/ai/director/story.ts), [styles](../src/lib/explanation.ts). The model does not verify its own claims. |
| React / Next.js / SVG | Displays stories, independent recap length/style, preferences, event locations and possession replay. | [Current demo](intelligence/DEMO.md). Schematic event endpoints, not tracking or footage. |
| Azure App Service | Hosts a previously deployed version. | [Deployment history/current read-only status](DEPLOYMENT.md). Merging does not update this host. |
| GitHub | Public source, pull requests, automated verification and manual deployment workflow. | [Repository](https://github.com/jbellamy16/second-look), [CI](../.github/workflows/ci.yml). |

This is one bounded model investigation with application tools. No Foundry Agent Service, Agent Framework, MCP orchestration, Fabric, managed identity or multiple collaborating model agents are implemented. Foundry is optional and disabled in the recording. Historical calls establish prior integration, not current reliability or viewer preference.

## Judging evidence map

The five criteria each carry 20% in the official rules. This maps evidence, not predicted scores.

| Criterion | Demonstrable feature / evidence | Remaining limitation |
| --- | --- | --- |
| Technological Implementation | Seeded events, cutoff-safe metrics, independent checks; [automated/browser evidence](submission-preparation/VALIDATION.md). | Generator is not calibrated to professional tracking; current live Foundry execution untested. |
| Agentic Design & Innovation | Broad retrieval, optional questions, structured selection and independent verification; [workflow](intelligence/foundry-efficiency-2026-10-11/REPORT.md). | Demo is offline. Historical successful example made no optional follow-up; no multi-agent claim. |
| Real-World Impact & Applicability | A late viewer can understand a change, catch up and check a replay. | Proposed benefit; [participant review](EDITORIAL-MILESTONE-2.md#viewer-review-checklist) pending. No enterprise-readiness result. |
| User Experience & Presentation | Two styles over the same facts; Quick/Full; evidence/replay; visible weakening caveat. | [114-second demo](intelligence/DEMO.md); physical Safari, screen-reader review and final voice recording pending. |
| Adherence to Hackathon Category | Explainable synthetic match intelligence with an implemented optional Foundry path. | Owner confirms category; [current live-evaluation proposal](intelligence/foundry-efficiency-2026-10-11/REPORT.md#current-submission-evaluation-addendum) needs separate authorization. |

## Judge setup and walkthrough

Use Node 24 and the lockfile. From a fresh checkout:

```sh
npm ci
AI_ENABLED=false AI_PROVIDER=offline FOUNDRY_ENABLED=false AI_PROACTIVE_ENABLED=false HISTORICAL_MATCHES_ENABLED=false RECORDED_MATCHES_VISIBLE=false npm run build
AI_ENABLED=false AI_PROVIDER=offline FOUNDRY_ENABLED=false AI_PROACTIVE_ENABLED=false AI_MINUTE_LIMIT=0 AI_HOURLY_LIMIT=0 AI_DAILY_LIMIT=0 AI_TOTAL_LIMIT=0 HISTORICAL_MATCHES_ENABLED=false RECORDED_MATCHES_VISIBLE=false PORT=3124 HOSTNAME=127.0.0.1 npm start
```

Open [the local demo](http://127.0.0.1:3124) in a fresh browser profile. No key, account, database or Azure service is needed. Process settings override any existing `.env.local`; do not overwrite it. Both build and runtime hide historical sources. If the port is occupied, choose another consistently. Stop with Ctrl-C.

1. Join **The pressure builds**, Curated demo, seed **202632**, paused at **63:24**. Harbor leads **1–0**; four shots replace zero in equal 9m12s windows. Plain English is the fresh-storage default.
2. Open **Catch me up**. Quick gives the score, early goal, development and key moments. Choose Full, then Quick: length is independent of style.
3. Close the recap. Select **Football Analysis**, then Plain English. Confirm unchanged facts, clock and chance-quality caveat.
4. **Explore evidence**: windows **45:00–54:12** and **54:12–63:24**. Click **59:09** beside Milo Serrano's shot. Six actions replay from **58:39** to **59:09**; the main clock stays at 63:24.
5. Seek to **70:00** while paused. The rolling comparison is four shots versus one across equal 12m30s windows. The headline says the increase eased: one shot in the latest half after three. This differs from the separate five-minute recovery storyline.

The [recording package](intelligence/DEMO.md) has exact cues, narration and screenshots. [Validation](submission-preparation/VALIDATION.md) separates current code, tests, historical live results, human review and public hosts.

## Release checklist and owner actions

| Item | Status / required action |
| --- | --- |
| PR #23 | Merged after review and green checks; human wording validation pending. |
| Preparation changes | Review the new draft PR; its merge is not authorized. |
| Registration / deadlines | Owner authenticates, confirms eligibility/registration and checks Projects fields against the dates above. |
| Public repository | Public visibility verified October 11. Owner chooses final submission commit and rechecks signed-out access. |
| Working demo | Current local build verified. Public source parity unknown; approve deployment separately, then verify exact release and judge access. |
| Current Foundry evaluation | Proposal: six workflows, twelve HTTP attempts, maximum **US$0.50** reserved spend. **Not authorized or executed.** |
| Human review | Use the [current viewer checklist](EDITORIAL-MILESTONE-2.md#viewer-review-checklist); older blinded study remains historical. No participants contacted or feedback invented. |
| Video | Script/screenshots ready. Owner records voice/screen, checks final duration and captions, then separately authorizes publication. No video published. |
| Attribution | Retain original fictional identities, [font/asset licenses](brand/ASSETS.md), [source restrictions](DATA-RIGHTS.md), repository license and dependency notices. Review the final video for unauthorized marks, footage or music. |
| Competition entry | Owner checks final links, authenticated requirements, rights and category; submission requires a separate instruction. |

The [original title graphic](../public/brand/video-title.png) is available; avoid adding a long title sequence. No deployment, AI enablement, Azure change, live call, outreach or competition submission occurred during preparation.
