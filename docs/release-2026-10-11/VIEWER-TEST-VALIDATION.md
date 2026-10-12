# Viewer protocol instruction validation

October 12, 2026 (America/Chicago). **Assistant checks only: 0 participant sessions; human validation pending.** No outreach, participant responses, paid inference, deployment or application changes were made for this update. The 10–12 minute duration is a planning estimate, not measured participant performance.

## Previous PR review and synchronization

Reviewed [PR #33](https://github.com/jbellamy16/second-look/pull/33) at `997c5f793a2b22952ca97106b1a77199f3c9e222`: the complete diff, explanation preference persistence, contribution boundaries, guided-answer wording, evidence access, recap independence and accompanying tests. No blocking issue found; no unresolved review threads or review comments were present. All four GitHub CI checks reported success (Node verification and Cloudflare, each on push and pull request).

Reran 71 relevant unit tests successfully before merging the reviewed head with a commit-match guard. PR #33 merged as `4b591cd0dfb86b3e14f0957144412f095d6147f2`. Fast-forwarded local main to origin/main and created the protocol branch from that commit. The pre-existing generated `next-env.d.ts` development-path change is preserved and excluded from this PR.

## Protocol rehearsal

Used the current checkout's existing Next.js development server at `http://127.0.0.1:3101`; `/api/insights` reported `mode: offline`, `configured: offline`, `proactive: false`. Reused that server after a separate start reported it was already running. Browser rehearsal used the synthetic fixture; the existing server also exposed Recorded mode, which was not used. The protocol's recommended offline start command hides recorded matches. Reviewed the local Next.js guidance and the repository start instructions.

| Instruction checked    | Observed application behavior                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup and reset        | Settings shows Generator profile / Curated demo (default). Reset demo closes Settings, returns to 63:24 and Harbor 1–0, and preserves the saved explanation level. Protocol explicitly resets the level afterward.                                                                                                                                     |
| Statistics baseline    | Match stats shows cumulative statistics through 63:24 and synthetic xG limitations. Match centre provides the recent comparison separately.                                                                                                                                                                                                            |
| Main development       | At 63:24 the story shows 0 → 4 shots across equal 9m12s spells, none scored, and cautions that more shots need not mean better chances. The quality question explains its unavailable zero-shot baseline.                                                                                                                                              |
| Guided comparison      | What best describes this shot surge? returns “No single explanation is established by these events.” The table shows shots 0 → 4, linked shots 0 → 0, linked spells 0 → 0 and opponent shots 0 → 0. Candidate explanations are Not established; source is Verified event analysis / No model investigation.                                            |
| Seek and fading answer | After keyboard adjustment, both clock and story read 70:00. Has this increase already faded? returns yes; wider shots are 1 → 4 and recent halves are 3 → 1. The protocol requires checking the visible clock and story after seeking.                                                                                                                 |
| Evidence replay        | Explore answer evidence contains 59:09 · shot · Replay. It opens a six-action passage starting at 58:39, with a separate replay clock and schematic-endpoint limitation. Main clock remains 70:00.                                                                                                                                                     |
| Levels and length      | Catch me up offers all three levels and Quick recap / Full recap. Observed everyday wording, named verified contributions and detailed comparison windows. Switching Football Fan to Advanced Analysis retains Full recap; switching to Quick retains Advanced Analysis. Score and weakening qualification remain. Settings reflects the shared level. |

Read-only check of the public `/release.json` returned `2014a497c84c799952c218a0229ec0c16bd964b1`, older than the study baseline. This check does not certify the hosted UI against the revised protocol. The protocol requires version/control verification and defaults to the current local application. No public deployment was performed.

## Focused regression checks

```sh
AI_ENABLED=false npx vitest run tests/explanation.test.ts tests/guided-investigations.test.ts tests/shot-surge.test.ts tests/recap-briefing.test.ts

AI_ENABLED=false AI_PROVIDER=offline FOUNDRY_ENABLED=false AI_PROACTIVE_ENABLED=false PLAYWRIGHT_PORT=3101 npx playwright test e2e/explanation.spec.ts e2e/guided-investigations.spec.ts --grep 'style persists|all six|offline question|shot surge comparison stays'
```

- **71 unit tests passed** across four files.
- **12 browser cases passed**: four existing journeys across desktop, Android-sized and iPhone-sized Chromium. They cover level persistence, all six level/length combinations, offline guided evidence/replay, shot-surge comparison, and included accessibility checks. The recap case exercises a local offline API request, not a model call.
- Markdown formatting, relative document links, required task/template coverage and whitespace were checked for the updated files.

This validates that the instructions match reachable controls and deterministic facts. It does not establish usability, comprehension, a preferred level, AI benefit, physical-device Safari behavior or screen-reader usability. No new automated tests or application code were added for the documentation update.
