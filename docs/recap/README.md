# Catch me up: an evidence-backed football briefing

The shared briefing replaces the synthetic and recorded-match paragraph recap. Quick recap leads with an editorial headline and a short narrative, two supporting comparisons when available, three important moments, and a measurable watch-next question. Full recap adds a complementary recorded passage, further measurements and moments, and the existing temporal storyline explorer. Both views use the same evidence and retain the exact selected match position.

## Implementation and trust boundary

`src/lib/recap-briefing.ts` consumes the existing Match Director observer, `packageStory` (including independent hypothesis verification and evidence graphs), and `reconstructStorylines`. Its immediate, offline briefing uses verified candidates. An explicit AI review calls the existing `/api/director`; the verified editorial selection then drives the same constrained narrative grammar. The model cannot supply new prose, scores, statistics, player actions or causal conclusions to this renderer. Query-derived window comparisons and player involvement reuse the Director's verified measurements.

The renderer distinguishes recorded facts, supported interpretations, and unresolved watch-next questions. Failed independent verification falls back to recorded context. Material counter-evidence—fading activity, an opponent's shot response, or rising shot volume without rising source xG—remains in the main reading. Unsupported claims are omitted. Detailed source events, measurements, comparison boundaries, limitations, verification checks and evidence graphs remain in **How we reached this conclusion**, using the existing `StoryEvidence` component.

Editorial priorities favor shot changes and advanced recoveries over routine pass counts. A recent goal takes headline priority; full time leads with the result and decisive scoring event. Moments rank goals above ordinary actions, favor recent significant events and verified support, and diversify repeated shots by the same player. Quick shows three; full shows up to eight. The complete recorded-action timeline is browsable in batches. Every Explore action connects to the existing pitch/passage explorer; substitutions retain the existing player or recorded-event exploration. No action implies available video.

No changes were made to hypothesis thresholds, counter-evidence tools, temporal state reconstruction, broadcast exports, provider models, spending limits or proactive-inference configuration.

## The 15-minute / 552-second inconsistency

Two legitimate engines had been surfaced in one paragraph without distinguishing their methods:

- Legacy `detectInsights` compares fixed 900-second windows. In the synthetic continuous-scope demo at 63:24, those are 33:24–48:24 and 48:24–63:24.
- Match Director uses equal windows inside the current period, each `min(900, floor((cutoff - period.start) / 2))` seconds. At 63:24, the second half has 1,104 elapsed seconds, so these windows are **45:00–54:12** and **54:12–63:24**, each **552 seconds / 9m 12s**.
- The temporal engine separately assesses completed, period-anchored five-minute windows. Its future monitoring criterion is labelled separately from the rolling comparison.

The calculations were not changed to fit a label. The briefing reads actual window boundaries and independently verified measurements from the hypothesis assessment, including `(start,end]` inclusion rules. Historical source limitations now describe equal windows without falsely imposing a universal 15-minute duration.

Metric definitions also matter: the older synthetic **ball wins** count includes recoveries, interceptions and tackles. Director **attacking-third recoveries** counts successful or outcome-unspecified recovery events with normalized x ≥ 66.7. At 63:24, the new recovery comparison is **2 against 0**, not the older broader metric's 4 against 0. At 65:00, it is **4 against 0** over two ten-minute windows. The briefing preserves these distinctions.

## Viewing context and rewind safety

`useViewingPosition` records a lightweight, browser-local checkpoint after two seconds of visible, focused match viewing. Keys include match identity, adapter version and source revision (including synthetic seed/profile). Hidden/inactive windows and open recaps do not move that checkpoint. The returning session's entry position is retained separately from the advancing playback cursor; a briefing snapshots its scope when opened. Leaving through **Back to the match** explicitly acknowledges that position without automatically starting playback.

Returning briefings highlight events after the prior position, while the score remains the whole-match score. Comparisons may need an earlier baseline; their ranges are displayed and a scope note identifies this. **From kickoff instead** switches to the complete match context without inference. Rewinding before the checkpoint returns to kickoff scope. Storage denial or invalid records falls back to a first-time briefing. No login or cross-device tracking is introduced.

A visible, focused dwell is a conservative proxy for viewing, not proof of human attention. A user leaving the computer with this window focused cannot be detected reliably. Playback itself already pauses on page invisibility; the checkpoint additionally enforces visibility/focus and excludes recap generation.

All scores, narratives, comparisons, timeline entries, source events and storyline assessments derive from the cutoff-bounded event prefix. Final-score metadata is never used. Future watch-next endpoints describe assessment windows, not unseen match events. The Director route now accepts finite fractional cutoffs so recorded source boundaries are not rounded backward. Closing, rewinding or changing source unmounts the briefing; late responses cannot overwrite another snapshot.

## Performance, cost and accessibility

Opening, switching quick/full, changing recap scope, or exploring evidence makes **zero model requests**. AI review remains explicit. The bounded client cache coalesces requests and reuses verified results across reopening and exact matching Director investigations. Keys include the canonical evidence object's identity, cutoff, preferences and Director version. Replacing evidence invalidates the cache; each per-match cache is capped at twelve entries. The existing server cache additionally hashes complete source data and preserves usage-store and provider controls. Unmounted views ignore an outstanding response; the shared request may finish into its own cache, without automatically retrying or starting another call.

The same React briefing renders both sources. It is computed only when opened, memoized independently of quick/full selection, and uses the existing icons and genuine synthetic club crests. Recorded fixtures have no licensed crest assets in this repository; they show club names without invented crests.

A native modal supplies inert background and focus restoration. Shared focus cycling, Escape dismissal, accessible roving tabs (arrows/Home/End), semantic sections, restrained contrast, reduced-motion support, bounded viewport height and internal scrolling are checked in Playwright. Mobile prioritizes the score and narrative; later sections remain available by scrolling.

## Validation and screenshots

Validation uses an isolated copy with inference disabled to preserve previous evaluation artifacts and the user's running development server. No paid Foundry or OpenAI evaluation was performed for this redesign. Tests exercise the actual offline Director endpoint and controlled delayed transport responses; they do not claim a new live-model quality result.

**Local result:** TypeScript and the production build passed; **412 unit tests passed, 2 optional integration tests skipped**; **171 browser tests passed** across all three configured viewport profiles.

- Type generation and TypeScript validation.
- Repository unit suite, including unchanged intelligence, hypothesis, storyline and graph tests; new briefing tests independently recount displayed metrics, verify score and attribution, remove future events, exercise uncertainty and sparse data, and validate cache/checkpoint behavior.
- Repository browser suite across desktop, Android-sized and iPhone-sized Chromium; new recap tests cover mode switching, keyboard focus, disclosure, event navigation, storage, background visibility, delayed review and rewind.
- Production build.
- Visual review at 1440×1100, 820×1180 and 390×844. Both modes were inspected, with no horizontal overflow or page errors. The screenshot run issued no inference requests.

Reproduce the screenshots against a local server with `RECAP_REVIEW_URL=http://127.0.0.1:3101 node scripts/review-recap.mjs`. The default port is 3101; this script only opens and inspects the interface.

| View    | Quick                                       | Full                                       |
| ------- | ------------------------------------------- | ------------------------------------------ |
| Desktop | [Screenshot](screenshots/desktop-quick.png) | [Screenshot](screenshots/desktop-full.png) |
| Tablet  | [Screenshot](screenshots/tablet-quick.png)  | [Screenshot](screenshots/tablet-full.png)  |
| Mobile  | [Screenshot](screenshots/mobile-quick.png)  | [Screenshot](screenshots/mobile-full.png)  |

[Mobile continuation: key moments, watch-next and evidence](screenshots/mobile-details.png).

## Review scope and remaining limits

This branch builds on open PR #19, which includes open PR #18's intelligence architecture and the latest `origin/main` at synchronization. The pull request is stacked on #19 to keep this redesign reviewable. Nothing is merged or deployed by this work.

The grammar is deliberately controlled, not free-form model-authored commentary. It cannot infer formations, defensive pressure, off-ball intent, missing possession time or unavailable chance quality. Sparse evidence yields fewer metrics/moments and may omit watch-next. A ten-second reading is the design target; it has not been validated in a timed fan study. Further editorial-quality work should be judged with the existing blinded review process before adding inference stages or model cost.
