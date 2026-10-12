# Bounded evidence discovery 1.0

This implements the catalogue foundation from [PR #37's proposal](AGENTIC-INVESTIGATOR-PROPOSAL.md). It is an offline, server-only interface for future deterministic and AI selection policies. Existing calculations, independent assessments and guided answers remain authoritative. There is no model invocation, new endpoint, runner integration or public activation.

Current additive version: `evidence-discovery-1.1.0` adds shared lead/group/overlap and compact viewer-evidence metadata plus an immutable, memoized local reader for [B1/B2](EDITORIAL-BASELINES.md). Original PR #38 scope and validation are recorded below.

## Shared interface

`buildEvidenceIndex(match, cutoff, context?)` in `src/lib/ai/director/discovery.ts` returns the same catalogue for either policy. `executeEvidenceOption(match, cutoff, { indexId, optionId }, context?)` reconstructs it from the caller's current canonical match state before resolving a registered action. Option `windowRefs` refer to the shared index window table. Question `measurementRefs` and `qualificationRefs` refer to their development’s tables; full repeated values are stored once. Resolved actions and complete windows are returned on reads. It does not accept caller-supplied windows, teams, players, anchors, hypotheses, purposes or tools. Each option fixes those fields in application code. Unknown options, omitted options, extra request keys and stale identities are rejected.

The identity includes the catalogue, Director and guided-question versions; canonical visible-prefix digest; exact cutoff; source provider, match identity, revision and adapter; capabilities; and viewer context. The digest excludes raw provider metadata, final-score metadata and future events/related-event references. The caller must supply its current cutoff on every read: an index from a later replay position cannot be used after rewinding. Cutoffs outside a recorded period, including interval gaps, are rejected. These functions have no mutable conversation state, and changing a returned index cannot change the next read.

External exposure is the default and rejects restricted sources before constructing evidence. Explicit `audience: "local"` permits deterministic inspection of restricted data; it is a trusted application setting and must never be supplied by a model. Such results retain their source restriction. Existing inference gates remain authoritative for any future integration.

## Catalogue and legal scopes

The index includes visible score context, capabilities, source-field coverage and verified observer developments before the personalized twelve-item shortlist. Developments retain deterministic measurements, assessment status, support/challenge summaries, missing-information notices, guided verdicts and the existing three shot-surge interpretations. It never withholds already computed verdicts to manufacture a need for investigation. Support and limitation codes/counts are summaries, with missing-information text and contradictory evidence visible; complete descriptions and references belong to the retrieved bundle. Summaries identify themselves as summaries; the read operation returns the complete selected assessment or guided answer, with its original references and qualifications.

The frozen v1 scope catalogue contains:

- Recent recorded team statistics and shot origins in the current period, at most 900 seconds.
- Two equal, complete same-period windows from the existing comparison-window function, at least 300 seconds each. Both ends retain fractional cutoff precision. Routes reuse `compareShotRoutes`; coordinates never become chance quality.
- Involvement for up to eight recently active recorded actors per team, selected by most recent involvement.
- Complete possession context for the latest six shot anchors per team, preserving team, period and event order. Unsupported possession identities and possessions exceeding 1,800 seconds are unavailable.
- Claim-specific counter-evidence and existing supported guided questions. Counter-evidence includes both teams when required; complete assessment windows and any earlier recovery context determine the fixed bounds. A bundle requiring more than 1,800 seconds or 20,000 assessment characters is unavailable.

The index holds at most 24 developments and 96 distinct options, within 48,000 serialized characters. Developments use deterministic rank, recency and ID ordering independent of preferences; personalized shortlist membership remains visible. Whole entries are omitted to fit, with counts and omitted development IDs. Preferences are bound to the identity; seen evidence is represented compactly by its count/digest and its effect on shortlist membership. A metadata envelope that cannot fit fails closed.

## Coverage and boundaries

Coverage distinguishes several independent facts:

| Field                             | Meaning                                                                                                                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index development/option coverage | Eligible, returned and omitted entries in this finite catalogue, including per-development option coverage.                                                                                                                                     |
| Observer/scope omissions          | Earlier shot anchors, non-leading qualifying passing pairs, over-limit claims, and players/sequences excluded by fixed scope caps. These counts have different units and must not be summed into a claim count.                                 |
| Source-field coverage             | Known/missing actors, shot outcomes, action locations, xG, possession identities, second-level timing, shot/recovery locations, pass outcomes, recipients and pass coordinates in the recorded sample. Provider completeness is always unknown. |
| Assessment coverage               | Considered/eligible/returned assessments, omitted assessment IDs and IDs whose entire support/challenge set was not covered by the query.                                                                                                       |
| Route reference coverage          | Eligible, returned and omitted references, retained even when the complete route comparison is suppressed.                                                                                                                                      |
| Result bundle / event details     | Complete, partial or unavailable answer evidence, separately from the number of event details displayed. At most 40 event details are shown; calculations and whole assessment references use the full eligible sample.                         |

An unknown pass outcome is excluded from the known-outcome denominator. Missing xG remains null/unknown, and unavailable possession/timing/location fields preserve unresolved interpretations. Complete delivery does not assert complete source observations or establish off-ball intent. All mandatory challenge text and references survive a targeted assessment; an illustrative sequence never replaces its aggregate.

Windows declare their period and inclusive/exclusive boundaries. Comparisons use `(start,end]`; assessment/possession retrieval can include its first recorded event using `[start,end]`. Sequence and route recovery context may begin before the statistical observation window, and is disclosed separately. Returned event details preserve exact `time`, `periodSeconds`, order, source event/match/team identity and timing precision. Display clock strings are not used as timestamps. Raw metadata and final-score metadata are never returned.

The original counter-evidence tool still returns at most two whole assessments within 20,000 characters. The new server-resolved claim target can retrieve a material assessment that a broad call omitted. Event truncation and assessment omission are reported separately and survive the existing compact evidence-wire serializer. Director/guided versions are bumped for the additive evidence metadata so existing cache identities cannot silently reuse older contracts.

## Validation and limits

Local validation: TypeScript and the production build passed. The offline suite passed 704 tests, including 22 discovery tests, with six environment-dependent skips. Formatting and whitespace checks passed. No paid inference was dispatched.

`tests/evidence-discovery.test.ts` exercises shared deterministic enumeration, competing descriptions, whole targeted challenge bundles, incomplete windows, source-field gaps, truncated event detail, suppressed route references, invalid requests/identities, restricted sources, fixed same-period windows, exact fractional timestamps, future-prefix invariance and rewind/revision invalidation. Existing Director, guided, shot-surge and offline comparison suites continue to exercise the underlying arithmetic and verifier.

This is a finite discovery catalogue, not exhaustive football analysis. Observer generation limits remain explicit. Output limits can exclude developments or reject an oversized complete response; missing evidence must not become an absence claim. Source-field coverage describes recorded data, not proof that every real-world event was observed. Source event strings remain untrusted data.

PR #38 introduced no B1/B2 selection policy. Those policies and deterministic stops are now implemented separately in the linked baseline module. A held-out evaluation corpus, investigator orchestration ledger, model plan and production publication integration remain unimplemented. The stateless read interface deliberately permits offline enumeration/replay without pretending cheap deterministic reads are paid requests. A future runner must account for every read within its existing four-tool allowance, reject duplicate workflow requests, and retain the shared attempt/deadline/reservation controls; it must not reset those controls by constructing new investigation instances. Existing public gates, HTTP/token/payload limits, Redis reservations and spending settings are unchanged. No paid calls are made or authorized by this foundation.
