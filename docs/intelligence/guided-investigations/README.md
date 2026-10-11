# Guided football investigations

The viewer can ask a bounded question about the selected story without replacing it. The answer leads with a conclusion, then measurements, window definitions and material qualifications. Evidence and replay remain available. Public AI settings are unchanged.

## Product walkthrough

1. Run `AI_ENABLED=false npm run dev` and open the local match centre. The pressure demo starts at **63:24**.
2. In **Look closer**, select **Is the other team improving too?** Riverside stays at 0 shots while Harbor rises from 0 to 4 over corresponding 9m12s windows. The answer is explicitly deterministic when AI is off.
3. **Are these chances actually better?** explains why the earlier zero-shot sample cannot support a per-shot comparison; no inference request is made.
4. Move the match timeline to **70:00**. Select **Has this increase already faded?** The wider shot count rises 1 → 4, while the halves of the current window fall 3 → 1. The answer retains both definitions.
5. Select **Are these chances actually better?** at 70:00. The synthetic per-shot ratings rise from 0.12 to 0.135; the recent slowdown remains a qualification.
6. Change **Plain English / Football Analysis**, open **Explore answer evidence**, and replay a listed action. The story, match clock and favorites stay in place. **Catch me up → Quick / Full** remains independent and makes no question request.
7. With an already configured permitted AI service, the same buttons investigate the explicit question. Loading keeps the recorded answer visible; cancellation, failure and retry are local to the question. Successful exact-context answers are reused. A rewind, changed source, selected story or different question invalidates pending display.

Browser fixtures simulate provider success/failure/cancellation; they never call a paid endpoint. Screenshots show deterministic product behavior, not live AI output.

## Evidence contract

- Intent is one of `chance-quality`, `opponent-improvement`, `fading-activity`, paired with a canonical source story ID and exact cutoff. Source data, implementation version, model and deployment are part of server cache identity; presentation is excluded.
- Quality separates shot count, total source xG and mean source xG per shot. Missing values remain null, and a zero-shot earlier sample has no mean. Source-model values are retained, not independently calibrated. Synthetic ratings are labeled synthetic.
- Opponent comparisons use the same metric and complete equal windows in the same period for each team. Fading compares equal halves within the current wider window. Start is excluded, end included; source timestamp precision is retained.
- Only relevant canonical activity stories offer all three questions; shot-origin stories can offer quality. Decisive score changes, full time and quiet spells retain existing priority/restraint. Known limitations and restricted sources do not dispatch inference.
- Foundry selects a typed verdict and optional verified supplemental context. It may use existing read-only evidence tools; calls are optional. Plans cannot include unrestricted factual prose or new numbers. All queries are replayed and evidence, identities, windows, verdict and supplements reconstructed before publication.
- Both styles render the same evidence. New questions share the existing 55-second workflow, 18-second transport, three-attempt, four-tool and 1,800-output-token safeguards and durable application controls.

## One authorized live campaign

`eval/guided-study` is a separate, single-use harness derived from the prior tested study guard. Historical runners, counters and receipts are unchanged. It uses a new localhost Redis on port **16380**, container/volume `second-look-guided-campaign`, synchronous AOF and no eviction. Initialization refuses a nonempty store; a manifest-bound execution claim refuses a second campaign. Retain this volume and all receipts.

Process limits are **2 workflows/minute; 12/hour/day/total; 30 HTTP attempts/minute; 30,000 tokens/minute**. The independent append-only ledger limits the campaign to **six workflows, twelve actual HTTP attempts including retries, and US$0.50**. Before each dispatch it reserves **$0.308100**: the entire documented 400k-token context at uncached input price plus all 1,800 output tokens. Settlement charges all actual input as uncached; unknown usage retains the reservation and stops paid execution. These are conservative token-rate estimates, not billing invoices.

Deployment identity and current Azure retail meters are refreshed read-only. The launcher retrieves the existing credential privately into its child process only. No persistent environment, Azure capacity, hosted setting or public AI status changes. Never rerun `scripts/run-guided-foundry.mjs` after receipts exist.

Predeclared cases, in order:

| Case                | Existing fixture and cutoff        | Question / reason                                           |
| ------------------- | ---------------------------------- | ----------------------------------------------------------- |
| unavailable-quality | pressure-fan, 63:24                | Quality: earlier zero shots, correct no-call                |
| misleading-quality  | historical diagnostic, 30:00       | Quality: 1 → 4 shots but total xG 0.8 → 0.2                 |
| opponent-response   | opponent-matches diagnostic, 30:00 | Both teams increase; Harbor 1 → 4, Riverside 0 → 5          |
| fading-increase     | temporal-weakening, 70:00          | Wider increase versus recent 3 → 1 decline                  |
| unfamiliar-opponent | balanced seed 8911, 70:00          | Corresponding opponent counts in unfamiliar play            |
| unfamiliar-quality  | balanced seed 8911, 70:00          | Volume, total and per-shot xG on the same unfamiliar source |

All use Harbor's canonical shot-increase story. Historical fixture regeneration preserves saved event fields; the existing opponent diagnostic is reused unchanged. Compared with the previous generic study, these use typed questions, include a first no-call workflow, and use seed 8911 twice for distinct intents. Seed 73129 has no relevant comparison story and is not forced into an investigation. No fixture is edited to improve model performance. Cases are frozen before any paid result.

Every actual answer is compared with a deterministic answer to the same question at the same cutoff. Assessment is **assistant analysis**, not human feedback; more tool calls or different wording is not evidence of improvement. Any terminal failure, unsupported claim, missing material qualification, verification mismatch, uncertain accounting or ceiling stops the campaign without replacements. Later fixes require offline validation; a second paid campaign needs new authorization.

## Verification

Targeted suites: `tests/guided-investigations.test.ts`, `tests/guided-study-guard.test.ts`, `tests/guided-study-store.test.ts`, and `e2e/guided-investigations.spec.ts`. The latter covers desktop, Android-sized and iPhone-sized touch views, tablet layout, keyboard activation, contrast, replay, preferences, style/detail independence, retries, intent separation/reuse, cancellation, rewind and source changes.

Durability tests use disposable test databases; never point destructive tests at the campaign store. Final validation and live results are recorded in the delivery report.
