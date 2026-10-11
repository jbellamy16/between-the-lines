# Editorial milestone 1: a story and its evidence

Rechecked against `main` at `687e658b82758f698548b4758db2e070a1840530` on October 11, 2026. There were no open pull requests at the start of implementation.

## Selection and presentation

The default match view uses one selected Director story for its headline, explanation, highlighted pitch actions and replay. The story sits beside the pitch on desktop and before it on mobile. Primary claim events are exported as `highlightedEventIds`; `evidenceEventIds` still contains every supporting measurement and counter-evidence reference. Extra context stays available in the evidence disclosure. A story replay steps through its recorded evidence; it does not animate invented movement between separate passages.

Secondary Director observations can be selected explicitly. Existing larger comparison samples remain available under Other observations & comparisons and Insights, with their own evidence view labelled Other observation. Returning to the main story restores its evidence. Favorites and category preferences still rank/filter observations; they cannot suppress a new score development or the full-time result.

The deterministic lead selector applies these rules:

- Full time leads with the result counted from visible scoring events, including own-goal attribution and excluding penalty shootouts. It does not read final-score metadata.
- A goal leads for five match minutes. A goal in the final fifteen minutes that leaves the sides level or one goal apart remains the lead for up to fifteen minutes. This describes the score, not a causal account of the result.
- Shot and attacking-third ball-win increases, ball-win-to-shot sequences and supported changes in shot origins can lead.
- Passing counts and passing pairs stay secondary. Player/substitute involvement requires at least two recorded shots to lead.
- No qualifying lead means no new headline. Secondary observations and recorded context remain available.

Score stories and quiet-spell abstentions need no model investigation. The server also enforces lead eligibility after an AI investigation: a routine passage cannot bypass these rules, and a rejected selection returns the deterministic fallback. Other configured investigations retain the existing retrieval, independent verification, source restrictions and fallback controls.

## Definitions and time

Both rolling comparison paths use complete equal windows within the current half: up to fifteen minutes each, with a minimum of five minutes each. At 63:24 in the demo, each window is 9 min 12 sec (45:00–54:12 and 54:12–63:24). Legacy explanations, bar labels and provenance use the actual duration.

Attacking-third ball wins share one definition across the observer, existing insights and statistics: recoveries without a recorded failure, plus successful interceptions and tackles, starting at x ≥ 66.7. In the synthetic feed, an interception or tackle starts a new possession and is inherently a successful win even when its legacy success flag is absent. Unknown outcomes in recorded feeds do not receive that assumption. Restarts are excluded.

The existing five-minute storyline history remains a distinct measure: recoveries only, assessed at a fixed cadence. Its scope is explained beside the history. It is not attached as if it were the broader ball-win measure.

Event times use source-aware formatting throughout Director explanations, evidence rows, replay pickers and tool output. Minute-only metadata still appears at the importer's conservative visibility boundary, but D. Gray's substitution is described as `~88′`, never as an exact `89:00`. Numerical cutoff times remain internal ordering boundaries.

## Actions and validation

Offline Explore evidence opens the checked comparison and events locally, without repeating the explanation through an API request. A configured AI provider adds a separately labelled investigation action with visible loading, failure and fallback feedback. Quick and Full remain recap length choices.

Regression coverage includes shared counts/windows, unknown outcomes, source precision and pre-substitution cutoffs, quiet-spell abstention, score priority despite favorites, result recomputation, selected story/pitch/replay alignment, investigation results after a secondary selection, offline requests, loading/failure feedback, responsive placement and rewind safety. Provider feedback paths use mocked transport; no paid inference is required.

Validation completed on October 11, 2026 with paid AI disabled:

- `npm run check`: type checking, 421 unit tests and production build passed. The two existing skips are the external Redis integration test and the opt-in local StatsBomb fixture.
- Production browser tests: 186 passed across desktop, Android-sized and iPhone-sized Chromium projects, with recorded matches visible.
- Cloudflare build and deployment dry run passed. Cloudflare browser tests: 144 passed and 42 recorded-match journeys skipped because that build hides recorded matches. No deployment was performed.
- Visually reviewed 1440×1100 desktop, 834×1112 tablet and 390×844 mobile views, including the selected story, its replay and the recorded full-time result. Browser tests check accessibility, overflow and the first-screen mobile explanation.
- Formatting and whitespace checks passed. No dependencies or runtime AI settings changed.

Next milestone: review the chosen football stories and plain-language explanations with viewers, then implement Plain English and Football Analysis with Explore Evidence available from either. Foundry optimization and audience settings remain separate work. Physical-device Safari testing and a separately authorized live editorial comparison remain outstanding.
