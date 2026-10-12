# Focused shot-surge investigation

Implemented October 12, 2026, following [the reviewed proposal](COMPETING-EXPLANATIONS-PROPOSAL.md). This is an offline-validated candidate. Public inference remains disabled. No paid model calls, new deployments, agents, services, quota increases or live study were used.

## Behavior

An optional **What best describes this shot surge?** question appears in Look closer for an eligible shot activity-change story. The deterministic answer compares repeated recovery-to-shot possessions, concentrated attempts and both teams' shot increases. All three descriptions, opposing evidence, missing-xG qualifications, exact windows and source limitations remain available in both presentation styles. The source story and goal/score priority are unchanged.

The frozen inference gate requires an increasing shot story, a complete route comparison, and at least two qualifying current recovery links in the existing hypothesis assessment. Zero or one link, missing source capabilities/identities/timing/locations, oversized evidence and restricted sources all keep the no-call answer. The bundled pressure fixture is unchanged: 63:24 and 70:00 remain negative controls.

`compare_shot_routes` is a read-only operation in the existing evidence runner. It derives the previous adjacent equal same-period window on the server and groups by the fixed match, period and team plus possession ID. It counts shots once and distinguishes linked shots from distinct linked possessions. Only successful-or-unspecified recoveries at normalized x ≥66.7, preceding the shot in the same possession within 30 recorded seconds, qualify. Tackles and interceptions do not substitute for recoveries. Generated possessions are labelled synthetic.

Shots use `(start,end]`; a recovery may precede the window boundary. Explicit context bounds and complete event references preserve that distinction. Missing possession identity is unknown. Complete aggregates are independent of the last 40 displayed events. Comparisons exceeding 120 references or 20,000 characters are suppressed, retaining the existing overall 48,000-character tool response limit and 1,800-second query bound.

## Foundry workflow

The initial packet contains the existing hypothesis assessment and all three existing guided answers, with repeated measurements and qualifications deduplicated. Nothing already computed by that baseline is withheld to manufacture a model query.

Within the existing question workflow, Foundry can stop with no added insight, choose the route/concentration aggregate, then optionally select a linked or unlinked current shot's sequence after seeing the aggregate. Complete aggregates precede illustrative sequences. Opponent activity is already supplied completely, so a redundant opponent query is not offered. Query purposes are audit labels, not private reasoning or evidence of usefulness.

The final typed plan carries source-story/intent identity, all interpretation IDs, checked statuses, registered supporting/challenging measurement IDs, a publication/no-added-insight/unresolved decision, and optional inspected replay anchors. The model controls emphasis, stopping and the illustrative evidence selection; it cannot write numbers, prose or causal claims. All interpretations and mandatory challenges survive that ordering. The verifier replays exact queries against a fresh canonical prefix, recomputes the comparison and rejects invented references, omitted challenges, wrong identities, unseen replay anchors and unsupported statuses. Rejected plans receive no repair calls.

This is one focused workflow extension. It reuses the provider adapter, 55-second deadline, request cancellation, shared cache, single-flight handling, durable reservations, pacing, unknown-usage treatment, output allowance and failure fallback. The ceiling remains three HTTP attempts including retries and four tool invocations including initial retrieval; the focused path currently needs at most three tools. Successful plans alone enter the AI cache. Cache identity includes the bumped guided version, intent/story, exact cutoff and canonical source revision. Presentation changes do not create new inference work.

## Offline validation and limits

Development diagnostics independently specify a 2 → 6 shot increase, four current recovery-linked shots, two linked possessions (versus one previously), 5 → 1 current-half shots and opponent shots 1 → 5. A matched variant retains shot/link totals but spreads links across four possessions and both halves. Tests assert the resulting concentration distinction and script different follow-up choices from the returned aggregates.

Tests cover missing IDs/locations/xG, minute timing, failed recoveries and tackle confusion, team/period isolation, boundary context, unchanged prior frequency, complete versus truncated evidence, reference caps, identity/prose injection, fresh reconstruction, prefix invariance, no-call controls, restricted sources, invalid queries/plans, no-added-insight, retries, incomplete usage, capacity/transport failures, cancellation, single-flight/cache revision/cutoff separation and the API contract. Browser tests cover the new no-call question, both styles, replay and rewind; existing guided tests cover cancellation, source replacement and late-answer races. The three-response diagnostic payloads fit the unchanged 30,000-token minute reservation ceiling, including three full output reserves.

These scripted transports establish orchestration and verification only. The deterministic comparison itself explains the diagnostic cases. No claim is made that the model improves that answer. The proposal's held-out recorded-match, live completion/cost/latency, fixed-retrieval comparison and blinded human-preference gates remain unmet. Any paid study or public activation requires a separate explicit authorization; this PR supplies neither.

Validation on the implementation branch: `AI_ENABLED=false npm run check` passed type generation/type checking, 564 unit tests (six environment-dependent skips), and the production build. The new suite contributes 40 tests. All 30 focused production-server browser tests passed across desktop, Android-sized and iPhone-sized Chromium viewports. Formatting and diff whitespace checks passed. Repository CI also runs the broader browser, Redis and Cloudflare suites; their results are recorded in the PR.
