# Model performance scorecard

Human review is pending. The first table is objective measurement within this synthetic study. The ratings below are assistant preliminary assessments, not a human preference result.

| Measurement                                                 | Observed                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Primary predeclared states / supplementary diagnostic       | 18 / 1                                                                |
| Accepted investigations                                     | 14                                                                    |
| Outcome breakdown                                           | {'accepted': 14, 'deterministic-abstention': 1, 'provider-failed': 4} |
| New HTTP requests                                           | 37                                                                    |
| HTTP outcomes                                               | {'200': 33, '429': 4}                                                 |
| Explicit counter-evidence requests                          | 0                                                                     |
| Counter-evidence requests returning assessments             | 0                                                                     |
| Unsupported published claims identified by automated checks | 0                                                                     |
| Actual application fallbacks executed                       | 0                                                                     |
| Offline fallback packages prepared for failures             | 4                                                                     |
| Input / cached input / output tokens                        | 183,527 / 16,000 / 1,962                                              |
| Returned-usage estimate                                     | $0.13567425                                                           |
| Unknown-usage reserve                                       | $0.24420000                                                           |
| Conservative accounted total                                | $0.37987425                                                           |
| Unused allowance                                            | $1.62012575; 23 requests                                              |
| Cost per accepted investigation (failures included)         | $0.009691 known; $0.027134 with reserves                              |
| Workflow median / observed p95                              | 7.771s / 12.859s, n=18                                                |
| HTTP median / observed p95                                  | 1.547s / 4.721s                                                       |
| Preliminary inappropriate abstentions                       | 0                                                                     |
| Preliminary repetitive outputs                              | 2                                                                     |
| Preliminary outputs where silence was preferable            | 1                                                                     |

Nearest-rank observed p95; small correlated sample. Includes request pacing, excludes 65-second inter-case cooldown. Not production p95.

Unknown usage is not declared free. Reservations are headroom, not a claim that Azure actually billed that amount. The direct investigator was tested; failure-path fallback execution is not a measured application statistic. Correctly abstaining before inference is not model restraint.

## Preliminary 1–5 ratings

N/A means the dimension does not apply or no model explanation was published. Failed states are included with no fabricated ratings. A score of 5 for grounding is limited to the supplied synthetic record and verification contract.

| Case                 | Relevance | Explanation | Grounding | Editorial | Continuity | Personalization | Broadcast |
| -------------------- | --------: | ----------: | --------: | --------: | ---------: | --------------: | --------: |
| misleading-quality   |         3 |           4 |         5 |         3 |        N/A |             N/A |         3 |
| opponent-matches     |         4 |           3 |         5 |         2 |        N/A |             N/A |         2 |
| fading-burst         |         2 |           3 |         5 |         2 |          2 |             N/A |         2 |
| inactive-favorite    |         3 |           3 |         5 |         3 |        N/A |               4 |         3 |
| quiet-routine        |         2 |           2 |         5 |         2 |        N/A |             N/A |         2 |
| kickoff              |       N/A |         N/A |       N/A |       N/A |        N/A |             N/A |       N/A |
| pressure-fan         |         4 |           3 |         5 |         3 |        N/A |             N/A |         3 |
| pressure-analyst     |         3 |           3 |         5 |         2 |        N/A |             N/A |         2 |
| temporal-emerging    |         4 |           3 |         5 |         4 |          2 |             N/A |         4 |
| temporal-weakening   |       N/A |         N/A |       N/A |       N/A |        N/A |             N/A |       N/A |
| temporal-resolved    |       N/A |         N/A |       N/A |       N/A |        N/A |             N/A |       N/A |
| rewind               |         4 |           3 |         5 |         4 |          3 |             N/A |         4 |
| after-substitution   |         4 |           3 |         5 |         3 |        N/A |             N/A |         3 |
| player-preference    |         4 |           3 |         5 |         4 |        N/A |               4 |         4 |
| unfamiliar-8911      |       N/A |         N/A |       N/A |       N/A |        N/A |             N/A |       N/A |
| unfamiliar-73129     |       N/A |         N/A |       N/A |       N/A |        N/A |             N/A |       N/A |
| quiet-fan            |         3 |           3 |         5 |         3 |        N/A |             N/A |         3 |
| full-time            |         3 |           2 |         5 |         2 |          2 |             N/A |         2 |
| active-favorite-theo |         4 |           3 |         5 |         3 |        N/A |               3 |         3 |

## Available baseline-output ratings

These are also assistant preliminary judgments. B is a genuine historical output, not a newly sampled or simulated answer. See the version and per-row rationale in `assistant-scores.json`.

| Case / arm                            | Relevance | Explanation | Grounding | Editorial | Continuity | Personalization | Broadcast |
| ------------------------------------- | --------: | ----------: | --------: | --------: | ---------: | --------------: | --------: |
| pressure-fan / legacy detector        |         4 |           3 |         4 |         3 |        N/A |             N/A |         3 |
| pressure-fan / historical 1.0.2       |         4 |           2 |         4 |         3 |        N/A |             N/A |         3 |
| pressure-analyst / legacy detector    |         4 |           3 |         4 |         3 |        N/A |             N/A |         3 |
| pressure-analyst / historical 1.0.2   |         3 |           2 |         4 |         2 |        N/A |             N/A |         2 |
| after-substitution / legacy detector  |         4 |           3 |         4 |         3 |        N/A |             N/A |         3 |
| after-substitution / historical 1.0.2 |         3 |           2 |         4 |         2 |        N/A |             N/A |         2 |
| player-preference / legacy detector   |         4 |           3 |         4 |         3 |        N/A |               3 |         3 |
| player-preference / historical 1.0.2  |         3 |           2 |         4 |         3 |        N/A |               4 |         3 |
| unfamiliar-8911 / legacy detector     |         4 |           3 |         4 |         3 |        N/A |             N/A |         3 |
| unfamiliar-8911 / historical 1.1.2    |         4 |           3 |         5 |         4 |        N/A |             N/A |         4 |
| quiet-fan / legacy detector           |       N/A |         N/A |       N/A |       N/A |        N/A |             N/A |       N/A |
| quiet-fan / historical 1.0.2          |         2 |           2 |         4 |         2 |        N/A |             N/A |         2 |

Per-output reasons are in [the complete case report](CASE-OUTCOMES.md). Read these alongside the scores; an average would hide the quota failures and distinct evidence limitations. No overall 'intelligence accuracy' percentage is computed.
