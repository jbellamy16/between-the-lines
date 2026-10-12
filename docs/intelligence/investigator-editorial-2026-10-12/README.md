# Verified editorial decisions: offline comparison

This evaluation makes verified investigator decisions visible without changing the application or calling a model. It rebuilds the catalogue and evidence trace, runs the existing independent verifier, then renders both the investigator selection and unchanged B2 through one presentation function. Model input is restricted to the existing structured selection schema. Unknown fields, invented IDs, stale traces, unsupported stops and missing mandatory evidence cannot supply factual prose or hide qualifications; they receive the full B2 fallback.

PR #41 was reviewed at `06504a43e072070e8c2477c23e1c3542ba508ad5`, with four successful GitHub checks, no review threads or blocking findings, and 86 focused tests passing (five isolated Redis tests skipped locally). It was squash-merged as `3007e1e`. This work starts from fetched `origin/main` at that merge. The original checkout, branch and local `next-env.d.ts` edit were preserved in place.

## Presentation contract

- The verified focal development supplies the headline and complete explanation. The first selected interpretation is explicitly labeled **Interpretation in focus**; subsequent selections are **Also considered**. Canonical supported/limited/unresolved statuses are always attached. Selecting a limited interpretation never promotes its status.
- Selected support and challenge IDs resolve to canonical evidence descriptions in visible focus paragraphs. They do not filter the full explanation. All distinct supporting observations, counter-observations, source limitations, unknowns, guided answers, measurements, comparison windows and competing interpretations remain present. Exact repeated role/text pairs are displayed once.
- The verified stop is rendered as a bounded investigation boundary. Coverage verification does **not** establish voluntary model stopping, tool availability, provider usage or operational feasibility. Those require the original transport/runner receipt.
- Both arms use the existing `presentStory`, `presentQuestion` and `questionText` functions for Casual Viewer, Football Fan and Advanced Analysis. Brief/detail share the same fixed 1,800/2,600 word ceilings for both arms. Counts include headlines, focus text, mandatory text and their labels. Detail adds canonical measurement rows. These are exhaustive offline review limits, not changed application length settings. They are maximums, not targets or a promise of equal word counts.
- If either complete explanation exceeds the shared ceiling, the pair is blocked. No qualification is truncated, hidden in an appendix or repaired by a model.
- B2 retains its original candidate policy, full initial reads, independent verification, stories and all answers. Its existing foreground order is applied to the shared renderer; the focus adapter gives it supported interpretations first, recorded supporting observation and the first relevant foreground challenge (before a generic caveat). In this fixture B2 already foregrounds the opponent response. Choosing that response is parity, not an investigator win.

All runtime `src/` files, B2 policy, investigator transport, caches, cancellation, fallbacks, provider controls, endpoints and Redis accounting are unchanged. The new code lives under `eval/investigator-editorial/` and is not imported into public routes.

## Generate and review

From the repository root, with dependencies installed:

```sh
mkdir -p artifacts
npm run eval:investigator:editorial -- artifacts/editorial-review-new
```

The directory must not exist; each run is exclusive. The command accepts only an output directory, blocks `fetch`, imports no investigator runner or provider/accounting module, and produces ten authored controls × three styles × two lengths = **60 pairs**. It never reads credentials or supplies live authorization. Assignment order is shuffled and sides counterbalanced, with the seed retained in the private key.

Only share `review/pair-*.html` with human reviewers. The self-contained pages work offline, have no scripts or external assets, display both arms under anonymous A/B labels, and support desktop columns, stacked mobile reading and print. Each has prompts for A/B/tie/cannot assess, exact supporting quotations and regressions. Text entered on the page is not saved; collect it separately or print. Do not share the private directory, this protocol's control descriptions or assignment key before review.

`sample.html` is one committed blinded example. Withhold `sample-key.json` from its reviewer. The full generated local run is `artifacts/investigator-editorial-2026-10-12-reviewed/`; generated bundles stay outside the focused source diff. `results.json` records the compact measured control outcomes and implementation hashes. Regeneration makes new anonymous assignments; the deterministic explanations and classifications remain the same.

Private records include:

- `*.audit.json`: exact submitted structured decision (including rejected fields), provenance, selected and applied plans, canonical replay result and rejection diagnostics, assessment verification checks, input fixture/digest, full initial evidence, verified focal material, B2 decision and both canonical outputs. Event references and measurements remain available for audit. Raw submission data never enters the HTML.
- `presentations.json` and `summary.json`: rendered text, word counts, verification/fallback disposition and difference classifications for every style/length pair.
- `key.json`: A/B mapping, shuffle seed and hashes of each HTML string (`sha256(JSON.stringify(html))`).
- `manifest.json`: source commit and exact source-file hashes, original PR #41 freeze hash, styles/limits and explicit null model/human outcomes. Source hashes identify uncommitted evaluated files as well as the base commit.

The reusable `evaluateEditorial(match, cutoff, context, submission, provenance, style, length)` entry also accepts an existing locally supplied model receipt's version/index/initial digest/trace/plan. It replays those decisions and ignores supplied rendered stories and success flags. Use `recorded-model` only for an actual captured receipt; the function does not authenticate provider provenance. Preserve the original receipt and raw structured provider decisions alongside it. This command intentionally exports authored mocks only. In this run, **actual model-selected decisions, model usage, cost and human judgments are null**, and paid calls are zero.

## What the controls establish

| Control                             | Expected observed distinction                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Same as B2                          | Identical output                                                              |
| Opponent counter-evidence           | Identical: B2 already makes this emphasis                                     |
| Quiet no-call                       | Identical deterministic empty selection                                       |
| Invalid factual prose               | Rejected decision; identical safe B2 fallback, not model success              |
| Secondary interpretation reordering | Reordered-only; no changed primary emphasis or information                    |
| Different supporting evidence       | Changed evidence focus; same complete information                             |
| Generic counter-evidence            | Changed counter-evidence focus; same complete information, potentially worse  |
| Limited interpretation in focus     | Changed priority; canonical limited status stays visible                      |
| Other focal development             | Different verified headline/measurements after two necessary evidence reads   |
| No further gain stop                | Changed stopping boundary; same underlying evidence, no voluntary-stop credit |

Across the six presentation combinations: 24 identical pairs (including six rejected/fallback pairs), 18 changed-emphasis pairs, six focal-development changes, six stopping changes and six reordered-only pairs. All fit their shared ceiling. `results.json` contains the measured word range.

The classifier compares actual displayed text and emphasis roles, not just selected IDs. It reports exact equality, normalized information equality, emphasis equality and a primary difference class. Moving the first interpretation into the explicit focus role changes editorial emphasis; merely reordering secondary material does not. Duplicate/equivalent references with identical wording receive no difference credit. This is deterministic textual comparison, not semantic judging or an automatic quality metric. `humanPreference` stays null and `improvementEstablished` stays false.

## Frozen evaluation status

**A new frozen candidate is required. The original PR #41 evaluation is not a valid freeze for this presentation.** Do not rewrite or regenerate its artifacts in place. The original `frozen.json` is preserved byte-for-byte with SHA-256 `33aef062567387734bad6bd0f80ecbf8f50c51465e87481109d576ca3b85dfbf`; its README, readiness record and offline measurements are also unchanged.

The old manifest still pins its original source hashes. Adding this offline npm entry changes `package.json`, so the old live runner rejects **Frozen source drift** before authorization, preflight or Redis access. The historical test now pins the original artifact, checks that this is the only drift among its existing source paths, and verifies the original package hash after removing exactly the new command. It does not bless a refreshed freeze. Newly added renderer files are recorded in this run's source manifest, not silently added to the old proposal.

A future evaluation must create a separately reviewed, newly frozen candidate that includes the renderer, source hashes, full fixtures and B2 output, matched presentation contract, blinded assignment protocol and preregistered human-review criteria. Existing allowance verification and separate paid-run authorization would still be necessary. This PR creates neither authorization nor a live candidate, and does not provision infrastructure, change counters or enable inference.

## Validation and limitations

TypeScript, **825 unit tests** and the production build pass. Eleven existing environment-dependent unit cases skip locally (isolated Redis/live-deployment gates); no Redis service was provisioned and no existing counters were touched. All 51 relevant browser cases pass across desktop, Android-sized and iPhone-sized Chromium, including the new offline artifact checks, accessibility, style persistence, pending investigations, cancellation, cache reuse, failure recovery, evidence selection and recorded-match rewind. The recorded-match cases were separately verified after building with their visibility flag enabled. Desktop/mobile artifact screenshots were inspected. Formatting and whitespace checks pass.

This is one authored synthetic development scenario plus an empty control, with deliberately selected mock decisions and repeated style/length views. It proves renderer sensitivity and safe handling of selections. It does not measure model decision quality, paid feasibility, live timing/cost, reviewer preference, generalization or production usability. The six presentations of a control are not six independent trials. Human review must be collected before any claim of benefit; regression, parity and inconclusive results are valid. Exhaustive offline explanations are longer than the application's compact story view, and some canonical technical caveats retain technical terms even in Casual Viewer style.
