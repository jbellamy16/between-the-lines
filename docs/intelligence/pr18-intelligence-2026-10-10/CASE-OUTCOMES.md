# Complete live case outcomes

All predeclared states are included. Estimates use returned usage; the separate reserve column retains unknown-usage attempts. No output is promoted to success merely because HTTP returned 200. Detailed plans, selected/rejected claims and public traces are in [results.json](results.json) and [requests.json](requests.json).

| Case                 | Clock / mode    | Outcome                  | Requests | Usage estimate | Unknown reserve | Workflow seconds |
| -------------------- | --------------- | ------------------------ | -------: | -------------: | --------------: | ---------------: |
| misleading-quality   | 30:00 / fan     | accepted                 |        2 |      $0.004606 |       $0.000000 |            8.341 |
| opponent-matches     | 30:00 / fan     | accepted                 |        2 |      $0.005740 |       $0.000000 |            7.695 |
| fading-burst         | 30:00 / fan     | accepted                 |        2 |      $0.004599 |       $0.000000 |            7.400 |
| inactive-favorite    | 30:00 / fan     | accepted                 |        2 |      $0.004640 |       $0.000000 |            8.426 |
| quiet-routine        | 30:00 / fan     | accepted                 |        2 |      $0.007364 |       $0.000000 |            9.306 |
| kickoff              | 0:00 / fan      | deterministic-abstention |        0 |      $0.000000 |       $0.000000 |            0.000 |
| pressure-fan         | 63:24 / fan     | accepted                 |        2 |      $0.011256 |       $0.000000 |            8.085 |
| pressure-analyst     | 63:24 / analyst | accepted                 |        2 |      $0.011388 |       $0.000000 |           11.190 |
| temporal-emerging    | 65:00 / fan     | accepted                 |        2 |      $0.011369 |       $0.000000 |            7.587 |
| temporal-weakening   | 70:00 / fan     | provider-failed          |        2 |      $0.002420 |       $0.056012 |            6.733 |
| temporal-resolved    | 75:00 / fan     | provider-failed          |        2 |      $0.002617 |       $0.057473 |            6.978 |
| rewind               | 65:00 / fan     | accepted                 |        2 |      $0.002124 |       $0.000000 |            7.766 |
| after-substitution   | 65:30 / analyst | accepted                 |        2 |      $0.012153 |       $0.000000 |           10.858 |
| player-preference    | 63:24 / fan     | accepted                 |        2 |      $0.011291 |       $0.000000 |            7.612 |
| unfamiliar-8911      | 70:00 / fan     | provider-failed          |        2 |      $0.002754 |       $0.065249 |            6.773 |
| unfamiliar-73129     | 70:00 / analyst | provider-failed          |        3 |      $0.011085 |       $0.065466 |           12.859 |
| quiet-fan            | 63:24 / fan     | accepted                 |        2 |      $0.009452 |       $0.000000 |            7.665 |
| full-time            | 90:00 / fan     | accepted                 |        2 |      $0.011083 |       $0.000000 |            7.796 |
| active-favorite-theo | 63:24 / fan     | accepted                 |        2 |      $0.009734 |       $0.000000 |            7.775 |

## misleading-quality

**Question:** Four shots versus one, but total synthetic xG falls from 0.8 to 0.2; qualify quality.

**State:** `live-challenge-misleading-quality`, cutoff 1800 seconds; fan; preferences `{}`. Scenario/seed: `{"fixture": "misleading-quality", "testOnly": true, "derivedFrom": "quiet", "seed": "explicit-events"}`. Input digest `f66c5424e08bd58cb7fa0979fdd6309cccdd92bb23310ff4601b2a310c1252a1`.

**Available shortlist:** 1 observations. Top three: Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Actual model tool sequence:** get_match_events `{"matchId":"live-challenge-misleading-quality","start":0,"end":1800,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [1, 2]. Tokens: 5,505 input / 106 output.

**Published/returned explanation:** At 30:00, Harbor Athletic 0–0 Riverside FC. Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. The source-supplied xG total did not rise, limiting a stronger chance-quality interpretation.

**Watch next:** Harbor: record at least one additional shot event over the remaining 14m 59.999s in 1H. A complete equal-window comparison will be unavailable.

**Assistant preliminary assessment:** The xG caveat stops shot volume being mistaken for chance quality. The model selected the lone prepared change and did not investigate counter-evidence; the renderer supplied the qualification. Fractional seconds and a one-more-shot watch criterion reduce usefulness.

**Human assessment:** pending.

## opponent-matches

**Question:** Harbor shot rise while Riverside has five attempts; no dominance claim.

**State:** `live-challenge-opponent-matches`, cutoff 1800 seconds; fan; preferences `{}`. Scenario/seed: `{"fixture": "opponent-matches", "testOnly": true, "derivedFrom": "quiet", "seed": "explicit-events"}`. Input digest `4d85dc70758163fb66b17f178b5fd3a826d815ab3d5eff70db099fed3e8e6ff3`.

**Available shortlist:** 2 observations. Top three: Riverside recorded 5 shots from 15:00 to 30:00, compared with 0 in the preceding equal window. / Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Actual model tool sequence:** get_match_events `{"matchId":"live-challenge-opponent-matches","start":0,"end":1800,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [3, 4]. Tokens: 6,789 input / 144 output.

**Published/returned explanation:** At 30:00, Harbor Athletic 0–0 Riverside FC. Riverside recorded 5 shots from 15:00 to 30:00, compared with 0 in the preceding equal window. Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Why it matters:** Riverside's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. The opponent matched or exceeded this shot count, so one-sided control is not established.

**Watch next:** Riverside: record at least one additional shot event over the remaining 14m 59.999s in 1H. A complete equal-window comparison will be unavailable.

**Assistant preliminary assessment:** Both teams appear, preventing a one-sided story. Repeated shot-activity and no-goal caveats make the significance text cumbersome; no optional investigation examined the opposing evidence.

**Human assessment:** pending.

## fading-burst

**Question:** Old four-shot burst has ended; wider count increase is not sustained momentum.

**State:** `live-challenge-fading-burst`, cutoff 1800 seconds; fan; preferences `{}`. Scenario/seed: `{"fixture": "fading-burst", "testOnly": true, "derivedFrom": "quiet", "seed": "explicit-events"}`. Input digest `e6ae93637948819b5f00eb3e43f6e8655a65eadf867012e23bccb11cec0bfc6b`.

**Available shortlist:** 1 observations. Top three: Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Actual model tool sequence:** get_match_events `{"matchId":"live-challenge-fading-burst","start":0,"end":1800,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [5, 6]. Tokens: 5,496 input / 106 output.

**Published/returned explanation:** At 30:00, Harbor Athletic 0–0 Riverside FC. Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. Activity slowed in the latest half of the current window, so the increase may be fading.

**Watch next:** Harbor: record at least one additional shot event over the remaining 14m 59.999s in 1H. A complete equal-window comparison will be unavailable.

**Assistant preliminary assessment:** The wider-window count is true and the renderer mentions fading, but the lead still revives a burst that ended around 15:40 at a 30:00 cutoff. The available resolved storyline never becomes a clear editorial resolution.

**Human assessment:** pending.

## inactive-favorite

**Question:** Favorite has zero events; do not manufacture a player story.

**State:** `live-challenge-inactive-favorite`, cutoff 1800 seconds; fan; preferences `{"player": "harbor-2", "team": "harbor"}`. Scenario/seed: `{"fixture": "inactive-favorite", "testOnly": true, "derivedFrom": "quiet", "seed": "explicit-events"}`. Input digest `59e08a2285043c2d00d536e7521cab64fd162c869e2256e4f43630a22f518ab5`.

**Available shortlist:** 1 observations. Top three: Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Actual model tool sequence:** get_match_events `{"matchId":"live-challenge-inactive-favorite","start":0,"end":1800,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [7, 8]. Tokens: 5,551 input / 106 output.

**Published/returned explanation:** At 30:00, Harbor Athletic 0–0 Riverside FC. Harbor recorded 4 shots from 15:00 to 30:00, compared with 1 in the preceding equal window.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window.

**Watch next:** Harbor: record at least one additional shot event over the remaining 14m 59.999s in 1H. A complete equal-window comparison will be unavailable.

**Assistant preliminary assessment:** No invented favorite contribution and match-wide development stays first. The model made no player query; restraint is demonstrated, useful personalized discovery is not.

**Human assessment:** pending.

## quiet-routine

**Question:** Repeated safe passes offer no meaningful change; consider silence.

**State:** `live-challenge-routine-passes`, cutoff 1800 seconds; fan; preferences `{}`. Scenario/seed: `{"fixture": "routine-passes", "testOnly": true, "derivedFrom": "quiet", "seed": "explicit-events"}`. Input digest `04d1cab0657e1ad9f711f94c01a30cb4185ede30846520e9f9ab7af4b2a86aa5`.

**Available shortlist:** 1 observations. Top three: Jude Moreno found Kai Solberg with 30 completed passes from 15:00 to 30:00.

**Actual model tool sequence:** get_match_events `{"matchId":"live-challenge-routine-passes","start":0,"end":1800,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [9, 10]. Tokens: 9,182 input / 106 output.

**Published/returned explanation:** At 30:00, Harbor Athletic 0–0 Riverside FC. Pass attempts so far. Harbor: 30. Riverside: 0. Jude Moreno found Kai Solberg with 30 completed passes from 15:00 to 30:00.

**Why it matters:** The 30 completed passes identify a repeated on-ball connection. Receiving space, movement and whether the pair bypassed opponents remain unknown.

**Watch next:** Record at least one further completed pass from Jude Moreno to Kai Solberg in the next observation window.

**Assistant preliminary assessment:** Thirty safe passes between two players is observable, but the unchanged low-location repetitive pattern supplies little match understanding. The next criterion is merely one further pass. Preliminary judgment: silence would be preferable in a live insight feed; a viewer could reasonably find the unusual pair count interesting.

**Human assessment:** pending.

## kickoff

**Question:** No events; abstain without a model call.

**State:** `quiet`, cutoff 0 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "quiet", "seed": 202612, "profile": "demo"}`. Input digest `e71fb70c2bc969be053e083e92f4a619d8e0fdf028c349fdbbdb1fb17aee412e`.

**Available shortlist:** 0 observations. Top three:

**Actual model tool sequence:** None (no model call).

**Outcome:** deterministic-abstention. Requests: []. Tokens: 0 input / 0 output.

**Published/returned explanation:** At 00:00, Harbor Athletic 0–0 Riverside FC. No match developments to highlight yet.

**Why it matters:** Scoring actions reconcile with the published match result; failed saves are not counted as additional goals.

**Watch next:** Watch how the next recorded passage develops.

**Assistant preliminary assessment:** Correct deterministic no-candidate abstention, zero paid requests. This does not demonstrate model judgment.

**Human assessment:** pending.

## pressure-fan

**Question:** Find the strongest change and a complementary named moment.

**State:** `pressure`, cutoff 3804 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `07acc9497459ef1058be895eb063672a4af8ef621077545970f0488bbd7d047e`.

**Available shortlist:** 8 observations. Top three: Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor recorded 2 recoveries in the attacking third from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":3804,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [11, 12]. Tokens: 14,288 input / 120 output.

**Published/returned explanation:** At 63:24, Harbor Athletic 1–0 Riverside FC. 01:00: Goal by Arlo Hayes · Harbor Athletic. Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. Harbor completed 5 passes in the possession before Theo March's shot at 62:50.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. 5 completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality.

**Watch next:** Harbor: record at least 4 shots in the next equal 9m 12s window to sustain the measured count.

**Assistant preliminary assessment:** Leads with four shots versus zero and identifies Theo March at 62:50. The second choice is a routine five-pass route; an available named recovery-to-shot sequence could be more informative. No follow-up distinguishes the two.

**Human assessment:** pending.

## pressure-analyst

**Question:** Explain the shot rise with useful qualification.

**State:** `pressure`, cutoff 3804 seconds; analyst; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `91bd920f3c09448fe6c318a3f707344a96ccf1c5f19f5b7376b2296ed0267686`.

**Available shortlist:** 8 observations. Top three: Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor recorded 2 recoveries in the attacking third from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor recorded 21 attacking-third actions from 54:12 to 63:24, compared with 2 in the preceding equal window.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":3804,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [13, 14]. Tokens: 14,290 input / 149 output.

**Published/returned explanation:** At 63:24, Harbor Athletic 1–0 Riverside FC. 01:00: Goal by Arlo Hayes · Harbor Athletic. Harbor: 4 shots (54:12–63:24) versus 0 (45:00–54:12). Each window is 552 seconds in 2H; this is descriptive, not evidence of cause. Harbor completed 5 recorded passes before Theo March's shot at 62:50, within the same period and possession. Missing events or off-ball movements cannot be reconstructed. 3 recorded successful passes from Jude Moreno to Theo March between 48:24 and 63:24. This is a directional pairing, not a measure of movement or chemistry.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. 5 completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality. The 3 completed passes identify a repeated on-ball connection. Receiving space, movement and whether the pair bypassed opponents remain unknown.

**Watch next:** Harbor: record at least 4 shots in the next equal 9m 12s window to sustain the measured count.

**Assistant preliminary assessment:** The meaningful shot rise leads, but all three slots are filled, including an ordinary three-pass pairing. The long sequence of limitations and two passing observations makes the output harder to use.

**Human assessment:** pending.

## temporal-emerging

**Question:** Recognize emerging high recoveries without claiming pressing intensity.

**State:** `pressure`, cutoff 3900 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `3b78fdfb7ce0ca4c5a09ac8918cea12ff49ff19163a8ff871d83249eaf0419d3`.

**Available shortlist:** 8 observations. Top three: Harbor recorded 4 recoveries in the attacking third from 55:00 to 65:00, compared with 0 in the preceding equal window. / Harbor recorded 4 shots from 55:00 to 65:00, compared with 0 in the preceding equal window. / Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":3900,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [15, 16]. Tokens: 14,439 input / 120 output.

**Published/returned explanation:** At 65:00, Harbor Athletic 1–0 Riverside FC. 01:00: Goal by Arlo Hayes · Harbor Athletic. Harbor recorded 4 shots from 55:00 to 65:00, compared with 0 in the preceding equal window. Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. This possession shows Harbor turning a recorded recovery into a shot. It identifies an attacking route to track; it does not establish that the ball win caused the chance or that pressing improved.

**Watch next:** Harbor: record at least 4 shots in the next equal 10m window to sustain the measured count.

**Assistant preliminary assessment:** Useful four-shot rise plus Milo Serrano recovery-to-shot passage. The model chose this over higher-ranked recoveries, but it did not make the emerging recovery storyline the story and made no optional follow-up. A strong inspectable sequence, not demonstrated temporal reasoning.

**Human assessment:** pending.

## temporal-weakening

**Question:** Recognize that Harbor high recoveries have weakened.

**State:** `pressure`, cutoff 4200 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `3e539e8cabe9455b6801885347ce9097505f6b542e361552bcd8c7bd60e4e45a`.

**Available shortlist:** 10 observations. Top three: Harbor recorded 4 shots from 57:30 to 70:00, compared with 1 in the preceding equal window. / Harbor recorded 4 recoveries in the attacking third from 57:30 to 70:00, compared with 1 in the preceding equal window. / Harbor won the ball at 68:09 before Nico Wells's shot at 68:36 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":4200,"team":null,"playerId":null,"eventId":null}`

**Outcome:** provider-failed. Requests: [17, 18]. Tokens: 2,962 input / 44 output.

**Failure:** Provider unavailable. No verified model publication. A deterministic fallback is retained separately in the receipt.

**Assistant preliminary assessment:** HTTP 429 on the editorial request. No new model explanation was published; model continuity quality is unavailable for this state. The deterministic fallback is separate.

**Human assessment:** pending.

## temporal-resolved

**Question:** Resolve the earlier Harbor recovery rise and notice Riverside.

**State:** `pressure`, cutoff 4500 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `6382bb91001fc07f615ee77478089f5cefb97759eb0bcaf879b93b289119eb7a`.

**Available shortlist:** 11 observations. Top three: Riverside recorded 2 recoveries in the attacking third from 60:00 to 75:00, compared with 0 in the preceding equal window. / Harbor recorded 4 shots from 60:00 to 75:00, compared with 2 in the preceding equal window. / Harbor recorded 4 recoveries in the attacking third from 60:00 to 75:00, compared with 1 in the preceding equal window.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":4500,"team":null,"playerId":null,"eventId":null}`

**Outcome:** provider-failed. Requests: [19, 20]. Tokens: 3,225 input / 44 output.

**Failure:** Provider unavailable. No verified model publication. A deterministic fallback is retained separately in the receipt.

**Assistant preliminary assessment:** HTTP 429 on the editorial request. No new model explanation was published; do not credit the offline resolution to Foundry.

**Human assessment:** pending.

## rewind

**Question:** Only the earlier state can influence this independent backward seek.

**State:** `pressure`, cutoff 3900 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `564c9da9495a5e95f8b9a790990c9abb731ef2e58b2a5b527649331711ab79c4`.

**Available shortlist:** 8 observations. Top three: Harbor recorded 4 recoveries in the attacking third from 55:00 to 65:00, compared with 0 in the preceding equal window. / Harbor recorded 4 shots from 55:00 to 65:00, compared with 0 in the preceding equal window. / Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":3900,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [21, 22]. Tokens: 14,439 input / 120 output.

**Published/returned explanation:** At 65:00, Harbor Athletic 1–0 Riverside FC. 01:00: Goal by Arlo Hayes · Harbor Athletic. Harbor recorded 4 shots from 55:00 to 65:00, compared with 0 in the preceding equal window. Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. This possession shows Harbor turning a recorded recovery into a shot. It identifies an attacking route to track; it does not establish that the ball win caused the chance or that pressing improved.

**Watch next:** Harbor: record at least 4 shots in the next equal 10m window to sustain the measured count.

**Assistant preliminary assessment:** The new response exactly matches the earlier 65:00 narrative and selected claims after future events are removed. Cutoff evidence passes. This is one successful repeated sample, not proof that every stochastic run returns identical choices or a browser-session test.

**Human assessment:** pending.

## after-substitution

**Question:** Name the substitute's recorded contributions without causal improvement.

**State:** `substitution`, cutoff 3930 seconds; analyst; preferences `{}`. Scenario/seed: `{"scenario": "substitution", "seed": 202611, "profile": "demo"}`. Input digest `93b0d9a4d82ff711051ef6199864eb221d60316c2c6c84cd0b9e110f963d5950`.

**Available shortlist:** 9 observations. Top three: Harbor recorded 2 recoveries in the attacking third from 55:15 to 65:30, compared with 0 in the preceding equal window. / Harbor completed 5 passes in the possession before Milo Serrano's shot at 64:23. / Harbor completed 4 passes in the possession before Jude Moreno's shot at 63:36.

**Actual model tool sequence:** get_match_events `{"matchId":"substitution","start":2700,"end":3930,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [23, 24]. Tokens: 15,226 input / 163 output.

**Published/returned explanation:** At 65:30, Harbor Athletic 0–1 Riverside FC. 59:09: Goal by Ben Rivers · Riverside FC. Harbor: 2 recoveries in the attacking third (55:15–65:30) versus 0 (45:00–55:15). Each window is 615 seconds in 2H; this is descriptive, not evidence of cause. Harbor completed 5 recorded passes before Milo Serrano's shot at 64:23, within the same period and possession. Missing events or off-ball movements cannot be reconstructed. Nico Wells came on at 55:30 and has 5 recorded passes, carries, shots, recoveries or interceptions since then. This does not establish a substitution effect or compare unequal playing time.

**Why it matters:** Harbor's higher recovery count in the attacking third (2 versus 0) identifies advanced ball-winning starting points. Inspect subsequent same-possession shots to see whether those regains become attempts; counts alone do not establish pressing intensity. 5 completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality. 5 recorded actions, including 0 shots, describe this player's observed involvement since the substitution. The sample does not establish a change in team performance or off-ball influence.

**Watch next:** Harbor: record at least 2 recoveries in the attacking third in the next equal 10m 15s window to sustain the measured count.

**Assistant preliminary assessment:** Names Nico Wells and five recorded actions after coming on, explicitly avoiding a causal improvement claim. Strong restraint and specificity. Three stories and lengthy caveats still need broadcast editing; the zero-shot involvement is modest rather than a major impact.

**Human assessment:** pending.

## player-preference

**Question:** Investigate Leon Costa when useful without hiding match-wide change.

**State:** `pressure`, cutoff 3804 seconds; fan; preferences `{"player": "harbor-9", "team": "harbor"}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `d8eaa3d98b634ec9f0ba66528d7971209eca2c5b922d61b684fc2551670ce1a2`.

**Available shortlist:** 8 observations. Top three: Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor recorded 2 recoveries in the attacking third from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":3804,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [25, 26]. Tokens: 14,334 input / 120 output.

**Published/returned explanation:** At 63:24, Harbor Athletic 1–0 Riverside FC. 01:00: Goal by Arlo Hayes · Harbor Athletic. Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. This possession shows Harbor turning a recorded recovery into a shot. It identifies an attacking route to track; it does not establish that the ball win caused the chance or that pressing improved.

**Watch next:** Harbor: record at least 4 shots in the next equal 9m 12s window to sustain the measured count.

**Assistant preliminary assessment:** Preserves the shot increase and a useful Milo Serrano recovery-to-shot passage without forcing Leon Costa into it. Inspection found Leon had only one recorded pass in this window: omission is appropriate restraint, not an active-favorite failure. A separate active-Theo diagnostic addresses the coverage gap.

**Human assessment:** pending.

## unfamiliar-8911

**Question:** Repeat the earlier balanced fixture for a historical comparison.

**State:** `synthetic-pressure-8911-balanced`, cutoff 4200 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 8911, "profile": "balanced"}`. Input digest `78996402b484b78410bfb787994c4f32c030fbd3ec1bfa4cc7cc2d74bfb365dd`.

**Available shortlist:** 11 observations. Top three: Harbor recorded 4 shots from 57:30 to 70:00, compared with 2 in the preceding equal window. / Harbor won the ball at 66:27 before Leon Costa's shot at 66:42 in the same possession. / Harbor won the ball at 65:11 before Milo Serrano's shot at 65:38 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"synthetic-pressure-8911-balanced","start":2700,"end":4200,"team":null,"playerId":null,"eventId":null}`

**Outcome:** provider-failed. Requests: [27, 28]. Tokens: 3,372 input / 50 output.

**Failure:** Provider unavailable. No verified model publication. A deterministic fallback is retained separately in the receipt.

**Assistant preliminary assessment:** HTTP 429 prevented a verified editorial result. This is the one matching historically recorded Director 1.1.2 synthetic state, so the best pre-PR model comparison remains unresolved rather than improved.

**Human assessment:** pending.

## unfamiliar-73129

**Question:** Generalize to a seed absent from previous live evaluation.

**State:** `synthetic-pressure-73129-balanced`, cutoff 4200 seconds; analyst; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 73129, "profile": "balanced"}`. Input digest `0ede428fdbbd692c7a937f771030b10443a96252e33096ce1cc10218083f1a6a`.

**Available shortlist:** 5 observations. Top three: Harbor won the ball at 62:41 before Jude Moreno's shot at 63:05 in the same possession. / Harbor completed 6 passes in the possession before Jude Moreno's shot at 63:05. / Max Rowan found Oscar Voss with 5 completed passes from 55:00 to 70:00.

**Actual model tool sequence:** get_match_events `{"matchId":"synthetic-pressure-73129-balanced","start":2700,"end":4200,"team":null,"playerId":null,"eventId":null}` → compare_time_windows `{"matchId":"synthetic-pressure-73129-balanced","start":3450,"end":4200,"team":null,"playerId":null,"eventId":null}`

**Outcome:** provider-failed. Requests: [29, 30, 31]. Tokens: 14,180 input / 100 output.

**Failure:** Provider unavailable. No verified model publication. A deterministic fallback is retained separately in the receipt.

**Assistant preliminary assessment:** The model chose a valid equal-window follow-up. It compared combined shot activity (two versus three) and passing activity, but the third request received HTTP 429. A real investigation occurred; its editorial usefulness and final qualification cannot be scored.

**Human assessment:** pending.

## quiet-fan

**Question:** Distinguish worthwhile recorded events from routine activity.

**State:** `quiet`, cutoff 3804 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "quiet", "seed": 202612, "profile": "demo"}`. Input digest `a3f9721ab0be5659577845e37e5a94095bae4923f17ccab2356ebab11edc87a3`.

**Available shortlist:** 4 observations. Top three: Harbor recorded 13 attacking-third actions from 54:12 to 63:24, compared with 1 in the preceding equal window. / Harbor completed 7 passes in the possession before Milo Serrano's shot at 62:29. / Kai Solberg found Milo Serrano with 3 completed passes from 48:24 to 63:24.

**Actual model tool sequence:** get_match_events `{"matchId":"quiet","start":2700,"end":3804,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [32, 33]. Tokens: 11,865 input / 123 output.

**Published/returned explanation:** At 63:24, Harbor Athletic 0–1 Riverside FC. 15:18: Goal by Felix Lake · Riverside FC. Shots so far. Harbor: 1. Riverside: 1. Harbor recorded 13 attacking-third actions from 54:12 to 63:24, compared with 1 in the preceding equal window. Harbor completed 7 passes in the possession before Milo Serrano's shot at 62:29.

**Why it matters:** Harbor recorded 13 attacking-third actions against 1 in the preceding equal window, identifying a change in on-ball activity to follow. Activity slowed in the latest half of the current window, so the increase may be fading. 7 completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality.

**Watch next:** Harbor: record at least 13 attacking-third actions in the next equal 9m 12s window to sustain the measured count.

**Assistant preliminary assessment:** The quiet scenario still contains a specific late shot and a measurable attacking-third action rise. Selecting these is defensible, and the renderer notes fading. It is not a true no-event state and cannot establish appropriate model abstention. The explanation remains mostly descriptive.

**Human assessment:** pending.

## full-time

**Question:** Give coherent end-of-match context and no future-match watch criterion.

**State:** `pressure`, cutoff 5400 seconds; fan; preferences `{}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `717ae1a8e70dad044be82cfbedca8b4632db64575a1bac10fc2f74d12b46804f`.

**Available shortlist:** 6 observations. Top three: Riverside recorded 22 forward passes from 75:00 to 90+00:00, compared with 13 in the preceding equal window. / Harbor completed 7 passes in the possession before Nico Wells's shot at 81:08. / Harbor completed 7 passes in the possession before Nico Wells's shot at 76:43.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":3600,"end":5400,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [34, 35]. Tokens: 14,052 input / 121 output.

**Published/returned explanation:** At 90+00:00, Harbor Athletic 2–1 Riverside FC. 77:33: Goal by Theo March · Harbor Athletic. Shots so far. Harbor: 15. Riverside: 3. Harbor completed 7 passes in the possession before Nico Wells's shot at 81:08. Riverside recorded 22 forward passes from 75:00 to 90+00:00, compared with 13 in the preceding equal window.

**Why it matters:** 7 completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality. Riverside recorded 22 forward passes against 13 in the preceding equal window, identifying a change in on-ball activity to follow. Activity slowed in the latest half of the current window, so the increase may be fading.

**Watch next:** Full time. Revisit the recorded passages.

**Assistant preliminary assessment:** Preserves the 2-1 final score, latest goal and 15-3 shot count; correctly replaces watch-next with a full-time revisit. The model-selected content is a seven-pass possession and a forward-pass increase that is already fading. It does not coherently summarize the earlier pressure or its resolution. The full-time clock also renders as 90+00:00.

**Human assessment:** pending.

## active-favorite-theo

**Question:** Supplementary diagnostic: does following active Theo March prompt a useful player investigation? Added after the primary favorite fixture was found to have only one pass.

**State:** `pressure`, cutoff 3804 seconds; fan; preferences `{"team": "harbor", "player": "harbor-7"}`. Scenario/seed: `{"scenario": "pressure", "seed": 202632, "profile": "demo"}`. Input digest `67fb3c4d02fd2d54a90f1c6e0340a439adfdbd4e8747711e5ec80bada481090e`.

**Available shortlist:** 8 observations. Top three: Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor recorded 2 recoveries in the attacking third from 54:12 to 63:24, compared with 0 in the preceding equal window. / Harbor won the ball at 58:39 before Milo Serrano's shot at 59:09 in the same possession.

**Actual model tool sequence:** get_match_events `{"matchId":"pressure","start":2700,"end":3804,"team":null,"playerId":null,"eventId":null}`

**Outcome:** accepted. Requests: [36, 37]. Tokens: 14,332 input / 120 output.

**Published/returned explanation:** At 63:24, Harbor Athletic 1–0 Riverside FC. 01:00: Goal by Arlo Hayes · Harbor Athletic. Harbor recorded 4 shots from 54:12 to 63:24, compared with 0 in the preceding equal window. Harbor completed 5 passes in the possession before Theo March's shot at 62:50.

**Why it matters:** Harbor's recorded shot activity has increased. This identifies more attempts; shot danger requires separate evidence. The extra attempts have not produced a recorded goal in this window. 5 completed passes connect this recorded possession to a shot, showing the on-ball route to that attempt without establishing off-ball movement or chance quality.

**Watch next:** Harbor: record at least 4 shots in the next equal 9m 12s window to sustain the measured count.

**Assistant preliminary assessment:** The selected second story names the active favorite Theo March, and the useful shot rise remains first. However, the narrative and selected claims are identical to the no-preference pressure Fan case. No player query was made despite nine pass attempts and two shots in the review window. Relevant output, but no demonstrated incremental personalization.

**Human assessment:** pending.
