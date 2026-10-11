# Baseline comparison: added qualification, unproven discovery

The new system can give a more specific, qualified explanation than the legacy detector. This study does **not** establish that Foundry discovers better football stories than the pre-PR Director, or that viewers prefer the additional text.

## What is actually compared

| Arm                                              | Evidence available                                                                                                | Fair interpretation                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A: original deterministic observations           | Frozen 18-state baseline; byte-unchanged detector evaluated on the new states                                     | Original thresholds and wording; no model behavior                                                                 |
| B: original Director 1.1.2                       | Frozen candidates/ranking for 18 states; one matching previously recorded real Mini response at seed 8911 / 70:00 | Candidate comparison is offline. The one historical model response is genuine. Missing model answers stay missing. |
| Earlier B sensitivity comparison: Director 1.0.2 | Five matching genuine historical model responses, plus a prior 8911 response available separately                 | Useful context for progress across several revisions; not evidence that PR #18 alone caused the difference         |
| C: Director 1.2.0 at PR #18's head               | This study's live receipts, including provider failures                                                           | Actual model choices under the existing deployment quota, with deterministic verification and rendering            |

All 18 frozen offline input hashes still match in the regression suite. The previously documented candidate counts remain 12 legacy observations and 82 Director candidates on those slots. PR #18 adds qualification and temporal structure; candidate-count equality is evidence against treating those additions as newly discovered stories. The live matrix exactly overlaps the frozen `pressure-4200-fan` state, but that new live investigation failed at the provider boundary.

The previous 1.1.2 model response for unfamiliar seed 8911 selected the shot rise and Leon Costa's recovery-to-shot passage. The new 1.2.0 attempt on that same state received HTTP 429 before an editorial result. Therefore the closest available original-versus-new **model** comparison cannot demonstrate an improvement. It demonstrates an operating-envelope limitation in the present configuration. Prior model comparisons used a different throughput allocation and pacing; their success cannot be transferred to this run.

## Specific gains and limitations

**Qualification:** In the misleading-quality challenge, four shots versus one would also trigger the simple detector. The new explanation adds that the synthetic xG total did not rise. In the opposing-activity challenge it explicitly limits one-sided control, and in the fading-burst challenge it mentions the latest slowdown. These are useful interpretation safeguards. They are produced by the deterministic hypothesis renderer, not evidence that a model-selected counter-investigation occurred. Much of this gain would also appear in the improved offline fallback.

The legacy detector already has its own why/watch fields, including the warning that shot frequency alone does not establish chance quality. The review package preserves those fields and the appropriate Fan/Analyst wording. Generic caveats are therefore not a new-system advantage; the incremental benefit is the specific computed qualification, where present.

**Specificity:** New pressure output identifies Theo March at 62:50 or Milo Serrano at 59:09, depending on the state. The older 1.0.2 pressure output sometimes said only “this shot.” Named players and timestamps are more usable. These wording fixes predate PR #18 in 1.1.x, so they must not be credited solely to the new hypothesis/storyline implementation.

**Editorial selection:** At 63:24 the new Fan result keeps the important shot rise, but chooses a five-pass shot passage rather than the available recovery-to-shot route. Analyst mode adds a low-value three-pass pairing. The original initial pressure response already included the shot rise and a recovery-shot relationship. The saved original repeat was less useful, but selecting only that weaker repeat would bias the comparison; the human package uses the first original response.

**Substitution:** The new result names Nico Wells and reports his five recorded actions without claiming the substitution caused improvement. The old 1.0.2 output had a less specific substitute statement and repeated two passing sequences. This is a practical improvement over that old response. The revised 1.1.0 historical output already named Nico and made the same three story selections, so the new evidence does not establish an additional PR #18 selection gain.

**Personalization:** The primary favorite-player state supplied Leon Costa, but he had only one recorded pass in the investigation window. Keeping the match-wide story is reasonable restraint, not evidence of failed player discovery. It also cannot demonstrate useful personalization for an active player. A separately labelled active-Theo diagnostic was added under the same study ledger; its result is in the case report. No generator was modified to make the favorite more active.

**Continuity:** The deterministic engine reconstructs emerging/weakening/resolved states. At 65:00, the new model selected shots and a recovery-to-shot sequence rather than the emerging high-recovery storyline. The 70:00 and 75:00 live follow-ups failed on quota. Rewind to 65:00 returned the same accepted selection with only the earlier evidence. This supports cutoff safety in the sampled case but does not demonstrate a successful live model narrative arc through weakening and resolution.

**Silence:** The legacy detector remains silent on the routine-pass challenge. The new model publishes the repetitive pair and asks for another pass. Whether 30 passes between two players is interesting is a human question; as an interrupting insight about this intentionally static passage, the assistant's preliminary judgment favors silence. The kickoff no-call abstention belongs to deterministic eligibility, not the model.

## Is the extra cost and complexity justified?

The additional hypothesis/evidence structure is justified as a useful safety and audit mechanism in this architecture. It does not by itself justify paying for a model on every eligible state. This run's record of optional investigations and the independent reviews must establish that incremental value.

Compare workflow cost with all failures and unresolved reservations included, using [the scorecard](SCORECARD.md). New workflow latency includes a 6.1-second request-spacing floor, while the old runs used different pacing/capacity; attributing the whole latency difference to PR #18 would be wrong. The current request packets can exceed the existing workflow token-rate allowance, so cheap per-token pricing does not ensure reliable delivery.

No controlled treatment effect, expert preference, fan retention benefit or broadcast productivity gain is claimed. The next worthwhile test compares edited selections against these saved outputs, with the data state held fixed and independent reviewers deciding whether the result helps them understand the match.
