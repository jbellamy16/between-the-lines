# Intelligence evolution and evaluation

## Subsequent real Foundry evaluation

The implementation account below describes the original offline work. The subsequent [PR #18 live review](pr18-intelligence-2026-10-10/REPORT.md) froze Director 1.2.0 at its committed head and made 37 bounded HTTP attempts under a separate durable $2/60-request ledger. It found 14 verified publications, four quota failures and one no-call abstention across 18 primary states plus one diagnostic. The new explanatory safeguards are visible, but there were no explicit model counter-evidence investigations, and the sole optional comparison failed before publication. Human review remains pending. See the [measured scorecard](pr18-intelligence-2026-10-10/SCORECARD.md), [baseline limitations](pr18-intelligence-2026-10-10/BASELINE-COMPARISON.md), and [prepared independent review](pr18-intelligence-2026-10-10/HUMAN-REVIEW.md). The historical offline measurements below are preserved, not relabelled as live quality evidence.

## Audit of the starting implementation

The comparison starts at `f7b0b87986efba09ca95bdf8750a39df31f1258f`, Director `1.1.2`. The app already has a canonical event model, synthetic and licensed historical adapters, seven bounded read-only tools, model-directed follow-up queries, independently replayed evidence retrieval, structured editorial plans, a `BroadcastStory` contract, caching, Redis spending controls, provenance and replay. Replacing this architecture would discard working safeguards.

The largest gap is the difference between a verified observation and an informative explanation. The observer supplies useful changes and sequences, but a count increase does not establish attacking quality, dominance, a tactical cause or a substitution effect. The original story package exposes evidence without a structured assessment of alternative explanations. Independent calls also lack a match-time account of whether an emerging observation continued or faded. Personalization influences ranking; it cannot guarantee a meaningful contribution by a favorite player.

The earlier [Foundry evaluation](../FOUNDRY-EVALUATION.md) reported repeated passing stories despite valid evidence. The subsequent [model comparison](../EDITORIAL-MODEL-COMPARISON.md) improved coverage and selection and retained Mini. It recorded 32 accepted workflows from 36 attempts, including correctly rejected outputs; only two case slots were rerun on final `1.1.2`. These historical results do not measure the engine introduced here. The larger model did not establish a sufficient usefulness gain after the final fixes. Keep the existing configured model; do not imply a new model comparison.

## Priorities and responsibility boundaries

1. **Foundation:** attach an independently recomputed hypothesis assessment to each eligible observation; make support, limitations, contradictions and unavailable evidence explicit. Protect publication from forged candidate text, statistics, identities and future evidence.
2. **Continuity:** reconstruct storylines from bounded event prefixes and complete same-period windows. Track persistence and fading without relying on an in-memory narrative that can survive rewind.
3. **Presentation and proof:** extend the existing broadcast contract and evidence disclosure, exercise adversarial cases, compare identical inputs with a frozen original, and provide an honest synthetic demonstration.

The model chooses useful investigations and an editorial selection from retrieved claims. Deterministic code owns facts, match-time boundaries, measurements, hypothesis checks, storyline state, source permissions and publication verification. This is constrained agentic investigation, not unrestricted tactical understanding. Templates provide the public wording; no private model reasoning is stored or shown.

## Implemented contracts and temporal rules

`hypothesis.ts` returns a named hypothesis, observation timestamp, explicit windows, supporting/contradictory/limiting evidence, source capabilities, missing information, independently reproduced measurements and machine-readable verification checks. Confirmed observations describe computed event facts. Supported interpretations remain constrained and descriptive (for example a recorded ball-win-to-shot route). Unsupported candidates cannot become broadcast stories. The status vocabulary reserves unresolved hypotheses, but this release does not publish speculative unresolved hypotheses or invent probability scores.

`inspect_counter_evidence` gives Foundry a useful optional follow-up within the existing four-tool/three-request allowance. It distinguishes an old burst fading in the latest half-window, an opponent matching shot activity, and—only when the source supplies complete values—shot growth without increased total xG. Missing xG is a limitation, never negative evidence. Shot-count explanations can identify actual recovery/shot links and complete recorded goal outcomes. Source capability flags and explicit event IDs gate every addition.

`storylines.ts` reconstructs state in O(events + completed five-minute windows). At onset, shots require at least three; advanced recoveries at least two. Both also require at least two more and 1.5 times the preceding window. That prior count becomes a fixed episode baseline. One, two and three consecutive qualifying windows mean emerging, developing and sustained; one and two below-threshold windows mean weakening and resolved. A resolved storyline needs a fresh adjacent-window rise to reopen. These are transparent editorial thresholds, not calibrated significance tests.

Each storyline has a stable match/period/team/metric identity, explicit episode and revision, bounded eight-assessment history and event relationships. Windows never cross periods. Reconstructing from the visible prefix makes rewind, arbitrary forward seeks and scenario switching deterministic. The client holds the current snapshot in viewing-session memory; no database is required. Proactive attempts use storyline episode/state changes to avoid repeated sustained-state investigations; a changed count alone in the same state does not trigger another request. Existing cooldowns and quotas still apply.

`BroadcastStory` schema `1.1.0` preserves existing fields and adds what changed, why it matters, a measurable watch-next criterion, hypothesis assessment, related storyline and typed intelligence graph. Consumers should accept the additive schema version. All evidence, including opposing/contextual measurements, is linked through insight → hypothesis → observation/measurement → windows/events → players/teams/possessions. The graph is built from canonical data and excludes provider raw payloads. It is a portable relationship index, not a graph database. Packages expire at the next relevant storyline assessment or existing 180-second ceiling.

The existing detailed UI remains intact: significance and watch-next text appear in the story, counter-evidence and checks use progressive disclosure, and the match-story history survives when an old observation stops qualifying. The API still supports separate Fan/Analyst output forms. This release does not restore a mode switch removed by the latest merged design. Offline stories and computed temporal history retain honest provenance; model abstention is not relabelled as AI publication.

## Reproducible evaluation

`scripts/evaluate-intelligence-baseline.ts` captured the original observer and legacy detector before source changes. [The frozen baseline](original-baseline.json) contains 18 state slots: pressure, substitution and quiet; 10:00, 60:00 and 70:00; Fan and Analyst. Every row includes the complete input hash, both original offline outputs and source-file hashes. The capture refuses to call changed source “original.” To repeat the original capture, run it in a checkout of the recorded reference with this script copied in; do not overwrite the fixture from improved code.

The paired evaluation uses the identical fixture, cutoff, audience and preference objects and checks their hashes. Its three arms are:

| Arm                           | What is measured                                               | What is not measured                               |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Legacy deterministic detector | Existing threshold observations                                | Model investigation or editorial judgment          |
| Original Director `1.1.2`     | Frozen observer candidates and ranking                         | A newly sampled original model response            |
| Improved Director             | Recomputed assessments, tool contracts and temporal storylines | Live model preference or paid-provider reliability |

Candidate counts measure coverage, not quality. Additional limitations and counter-evidence measure explicit qualification, not proof of better football insight. A scripted provider test verifies orchestration, bounds and rejection behavior; it is not evidence that a live model would choose the scripted calls or that viewers prefer its selection.

The challenge matrix adds empty action, one isolated shot, repetitive passes, attacking activity without a goal, misleading trends, opposing evidence, substitutions, inactive favorites, unfamiliar seeds, rewind/future leakage, missing capabilities, duplicated candidates, malformed plans and provider unavailability. It constructs test-only event fixtures without changing the synthetic generator to favor results.

Run `npx vitest run tests/intelligence-evaluation.test.ts` for the expanded matrix. `npm run eval:director` and `npm run eval:ai` preserve the existing observer and narration evaluations. Ordinary tests must remain offline; live harnesses require a separately authorized explicit allowance. Machine-readable results are written to `artifacts/intelligence-evaluation.json`; the normal unit runner also includes this file.

## Quality targets and human review

These are release targets, not current quality claims:

| Dimension             | Gate or review target                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factual accuracy      | Every published measurement recomputes; zero accepted fabricated values or evidence IDs in the challenge suite                                                                                      |
| Evidence completeness | Every necessary event lies inside the declared cutoff and comparison bounds; partial retrieval cannot authorize publication                                                                         |
| Temporal consistency  | Exact prefix invariance; rewind produces the same result as a fresh call at the earlier time                                                                                                        |
| Abstention            | Empty and isolated-action fixtures do not become invented trends; unavailable capabilities do not become inferred facts                                                                             |
| Repetition            | Duplicated claim IDs and overlapping evidence cannot fill multiple editorial slots                                                                                                                  |
| Reliability           | Contract failures fall back safely; no automatic extra paid request to repair rejected output                                                                                                       |
| Relevance and clarity | Human reviewers score at least 4/5 on each; no unsupported tactical implication                                                                                                                     |
| Discovery             | Blind reviewers identify an additional useful insight or better-ranked story relative to both baselines; simply producing more claims does not pass                                                 |
| Personalization       | A supported favorite-player detail increases relevance; an inactive favorite never displaces a clearly more significant story solely to satisfy preference                                          |
| Latency and cost      | Measure live end-to-end median/p95 and token cost per accepted investigation, including failures and unresolved reservations, in an authorized evaluation; offline timings do not satisfy this gate |

Human review remains unscored until people perform it. Randomize the three arms and hide model/version labels. Give each reviewer the same cutoff, score context, preferences and replayable events. Use at least two football-literate reviewers and one broadcast/editorial reviewer; resolve disagreements explicitly rather than averaging away a factual error. Record the number of matches, unique cutoffs and reviewers; repeated judgments of one match are not independent matches.

Score the following from 1 (harmful/unhelpful) to 5 (ready to use):

| Criterion            | Review question                                            | Anchors                                                                                        |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Football relevance   | Does this change what the viewer notices?                  | 1: routine count; 3: useful context; 5: meaningful development with the right caveat           |
| Broadcast usefulness | Could a commentator use this immediately?                  | 1: confusing or too long; 3: needs editing; 5: clear, timely, concise                          |
| Explanatory value    | Does it explain significance without inventing causality?  | 1: unsupported cause; 3: descriptive caveat; 5: useful significance and competing evidence     |
| Continuity           | Does it account for earlier observations and later change? | 1: contradiction/repetition; 3: coherent update; 5: useful resolution or qualification         |
| Preference relevance | Is the chosen detail useful for this viewer?               | 1: forced favorite; 3: relevant detail; 5: improves understanding without hiding match context |
| Evidence usability   | Can the reviewer reproduce and replay the claim?           | 1: unverifiable; 3: evidence is present; 5: minimal, clear evidence and limitations            |

Also record binary factual errors, inappropriate abstention, missed significant stories, duplicate observations and pairwise preference against each baseline. Preserve free-text reasons and adverse examples. Report human preference separately from automated verification, including ties and disagreements.

## Model and Foundry integration

Keep the existing efficient Foundry deployment and fail-closed spending controls. Cheap preprocessing and event-prefix reconstruction run locally. Foundry remains responsible for choosing a useful bounded follow-up and final editorial plan; the first broad query supplies complete prior/current evidence. New evidence assessments are read-only tool data and never themselves authorization to publish. Final claims still have to be independently reproduced.

No paid inference, new Azure resource, public enablement, quota increase or production deployment is part of this offline implementation. Existing live test receipts describe older versions only. A next model study should freeze the revised code, randomize paired cases, include unfavorable/abstention cases, account for rejected attempts and collect blinded human ratings before recommending a model upgrade.

## Commercial scope and remaining limitations

`BroadcastStory` is a reusable output contract rather than React-only state. Stable match/story identities, source revision, verified evidence IDs, audience, visualization, presentation windows and explicit limits support future use in a second screen, broadcast graphic or editorial workstation. A preview/export is not a production broadcaster integration.

Commercial use would require licensed event-feed contracts and redistribution rights; ingestion with corrections, deduplication and revision-aware invalidation; verified competition clocks and provider semantics; production Redis concurrency/spending assurance; capacity and latency testing; authentication and tenant isolation; monitoring, editorial override and audit retention; broadcaster-specific graphics adapters; and prospective human football review. None of these is established by synthetic contract tests.

Off-ball positioning, formations, pressing intensity, running distance, intentions, instructions and causal effects cannot be recovered from this event feed. Shot frequency and normalized location are not chance quality. Historical source-specific restrictions remain in force; the hackathon demonstration uses project-owned synthetic data only.

## Measured offline results — October 10, 2026

The focused run of `intelligence-evaluation`, `director-evaluation`, `director`, `storylines` and `hypothesis` passed **124 tests in five files**. The new evaluation file contributes **49 tests: 18 paired state slots and 31 challenge cases**. All 18 input hashes match the frozen original. Fan/Analyst views of the same fixture are separate state slots, not independent matches.

| Observed across the 18 paired slots       | Legacy detector | Original Director |       Improved Director |
| ----------------------------------------- | --------------: | ----------------: | ----------------------: |
| Candidate observations                    |              12 |                82 |                      82 |
| Structured hypothesis assessments         |               — |                 0 |                      82 |
| Structured limiting-evidence entries      |               — |                 0 |                     130 |
| Structured contradictory-evidence entries |               — |                 0 |                       4 |
| Temporal storyline instances              |               — |                 0 | 6, present in six slots |

The new engine does not claim more original shortlist discoveries: its candidate count is unchanged. It makes interpretation limits and temporal qualification explicit. The separate player-window challenge demonstrates an investigable claim outside the initial shortlist; that capability already existed and is not counted as a newly invented advantage. The fading-burst challenge preserves a true wider-window shot increase while exposing evidence that it did not persist. The original shortlist count alone could not express that temporal qualification.

One useful failure was found during implementation: broad and event-anchored counter-evidence queries could exceed the existing 48,000-character tool response cap and terminate the workflow. The tool now returns up to two intact assessments within a 20,000-character assessment budget, discloses eligible/returned counts and truncation, and supplies narrower-query guidance. The expanded suite preserves a regression for the broad query and a successful three-turn scripted Foundry investigation.

No challenge is marked passed merely because an API returned HTTP 200. Cases assert evidence membership, recomputation, appropriate rejection or abstention, and temporal reconstruction. The final machine report contains all 31 named challenge outcomes, including the scripted malformed and unavailable-provider cases. There were **zero real provider requests and $0 actual inference cost**. Scripted calls and local execution times are not provider reliability, production latency or model-quality measurements. Human relevance, discovery, broadcast preference and improved live model quality remain **not evaluated**.

This section records the focused local evaluation only. The final task report separately records full type checking, unit tests, build, browser checks and GitHub CI. No deployment is claimed.

## Final local verification

- `npm run typecheck`: passed.
- `AI_ENABLED=false npm test`: **397 passed, two optional skips**. Skips are the local real-Redis service test (no `REDIS_TEST_URL`) and opt-in restricted StatsBomb fixture verification. CI supplies its own Redis service; no source rights were changed to remove the research skip.
- `npm run eval:director`: **140 passed in six files**, including the original 200-state observer matrix, 18 paired original/improved states, 31 named challenges, hypothesis, graph and temporal tests. These overlap the full unit suite; do not add them as independent checks.
- `npm run eval:ai`: **45 passed**, including the existing 180-case narration matrix.
- `AI_ENABLED=false RECORDED_MATCHES_VISIBLE=true npm run build`: passed.
- Production Playwright with recorded-source UI enabled: **150 passed** across desktop, Android-sized and iPhone-sized Chromium. This includes the 15 focused Director tests. After the final player-scoping correction, typecheck/unit/build and the 15 focused production Director checks were rerun; GitHub CI validates the full suite on the submitted revision.
- `git diff --check`: passed.

Independent review caught a player/team scope error during implementation: Hugo Silva's 0→2 shots could be described as a Riverside increase despite the team's 2→2 total. The final hypothesis, explanation and watch retain player scope, and a dedicated regression preserves the distinction. Earlier response-size and missing graph-measurement failures are also fixed with regressions. No observed failing check was hidden by a relaxed assertion.

GitHub check outcomes will be linked from the pull request. No paid inference, public enablement, merge or deployment was performed.
