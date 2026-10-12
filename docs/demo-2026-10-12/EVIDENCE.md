# Claims and supporting evidence

This package distinguishes implemented behavior, measured historical model results and proposed viewer benefits. Automated checks establish that the selected path works; they do not establish comprehension or broad reliability.

## What we can show

| Statement                                                                  | Evidence                                                                                                                                                                               | Boundary                                                                                                                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Harbor shots rise 0 → 4 at 63:24; later activity eases                     | Current local footage and screenshots; [viewer answer key](../release-2026-10-11/VIEWER-TEST.md#facilitator-answer-key--do-not-read-aloud); `tests/guided-investigations.test.ts`      | Seeded fictional match, not a live Premier League feed. Counts describe events, not cause or future outcomes.                                                       |
| Three explanation levels retain facts and limits                           | [Current level screenshot](assets/04-advanced-analysis.png); `src/lib/explanation.ts`; `e2e/explanation.spec.ts`                                                                       | Local deterministic formatting, not new model-generated prose or learned user preferences. Quick/Full is independent.                                               |
| Shot-surge question compares candidate explanations                        | [Comparison screenshot](assets/05-guided-comparison.png); `src/lib/ai/director/shot-routes.ts`; `tests/shot-surge.test.ts`                                                             | At 63:24 no single explanation is established. The comparison's gains came from deterministic code.                                                                 |
| Supporting events can be replayed without moving match time                | [Replay screenshot](assets/08-replay.png); recording assertions; guided browser checks                                                                                                 | Six discrete synthetic actions, not broadcast video, tracking or a causal proof.                                                                                    |
| Foundry provides structured selection through an actual deployed model     | [Original guided-study report](../intelligence/guided-investigations/REPORT.md); [original results](../intelligence/guided-foundry-2026-10-11/results.json); `src/lib/ai/providers.ts` | Historical provider execution. Current demo is offline; no new live success is asserted.                                                                            |
| Application code supplies evidence, checks model choices and renders facts | `src/lib/ai/director/question-runner.ts`, `tools.ts`, `questions.ts`; [role card](assets/foundry-role.png)                                                                             | Verification depends on application correctness. It is not a universal guarantee against wrong conclusions.                                                         |
| Five model answers and one appropriate no-call in the October 11 campaign  | [Receipt card](assets/foundry-receipt.png), [derivation and SHA-256](assets/foundry-provenance.json), original results                                                                 | Five HTTP attempts. Every completed answer matched its same-question deterministic baseline. Zero optional follow-ups. No added investigative benefit demonstrated. |
| A newer offline study found additional useful evidence                     | [Director offline evaluation](../intelligence/DIRECTOR-OFFLINE-EVALUATION.md)                                                                                                          | All 28 additional useful fact–case pairs came from deterministic route calculations. Mocked selection does not establish model improvement.                         |

## Foundry's actual boundary

For the historical fading case, the application retrieved `get_team_statistics` for the relevant event prefix before the model request. Microsoft Foundry's Azure Responses endpoint served the existing `between-the-lines-gpt54-mini` deployment (`gpt-5.4-mini`, version `2026-03-17`, as recorded in the study). The model returned a structured plan:

```json
{ "intent": "fading-activity", "verdict": "lower", "supplementIds": [] }
```

The application compared the verdict with its recomputed canonical answer, checked evidence references and qualifications, and rendered controlled factual wording. The receipt reports one request and one application retrieval for this case. That retrieval was **not** a model-chosen follow-up. Optional read-only follow-up tools are implemented, but none were selected in this campaign.

The evaluated commit was `b56090090cf85c43a28ca07755764082d7bcaec3`, question workflow `guided-1.0.0`, Director `1.4.1`. Later UI, shot-surge and explanation-level work is not covered by those historical paid results. The [newer investigation preflight](../intelligence/investigation-foundry-2026-10-12/README.md) ran offline and did not execute its proposed paid pilot. Earlier failed studies remain available and are not reclassified as successes.

Foundry Agent Service, Microsoft Agent Framework, MCP orchestration, Fabric, managed identity and a multi-agent system are not implemented here. Azure App Service hosts the older public release; it is separate from Foundry inference. The demonstration does not imply a new deployment, public AI enablement, or a measured Foundry productivity/scalability improvement.

## Material limitation: broader safety gate remains failed

The newer offline evaluation found **11 incorrect equal-quality-as-lower conclusions** in each comparison arm: strict floating-point comparison can label two displayed 0.1 xG-per-shot values as different. No application fix is included in this demonstration PR. The publication-safety gate remains failed even when automated regression tests pass, because the evaluation tests preserve and report the known defect.

The filmed path uses shot counts, the unavailable zero-baseline quality explanation, and fading activity. Their selected checkpoints were separately validated. This selection does not establish overall correctness, release readiness, or safe public AI activation. Keep this limitation in technical review materials, and do not turn the five historical matching answers into an accuracy percentage or a claim that the verifier catches every error.

## Questions judges may ask

**What does the AI add today?** The implemented contribution is constrained model selection over retrieved evidence, with optional bounded follow-ups. The historical campaign demonstrated five verified selections. It did not demonstrate better answers or extra evidence than deterministic code. Whether model-selected emphasis or investigation improves the viewing experience remains unmeasured.

**Why show an offline application?** It exposes the strongest working viewer journey without misrepresenting a model call. The historical card makes the real Microsoft integration inspectable, separately from current deterministic features. This is honest preparation, not proof of competitive category fit.

**Is personalization AI?** These three levels are local renderings of shared verified facts. Favorites can affect relevance, but this short demo focuses on the level control. No learned profile, language translation or model call per level change is claimed.

**Does it help viewers?** That is the intended benefit. [The usability study](../release-2026-10-11/VIEWER-TEST.md) is prepared; zero participant sessions are reported. No preference scores, quotes, completion improvements or comprehension gains have been collected.

**Is this real football data?** The filmed fixture is synthetic, with fictional players and model-generated event probabilities. xG is the generator's shot probability, not a calibrated professional model. Historical research capabilities elsewhere in the repository are not part of the submitted configuration or this model study.

## Fit to the hackathon story

The [official rules](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md), read October 12, call for a functioning video shorter than two minutes. The five equally weighted criteria cover implementation, agentic design, impact, experience/presentation and category fit. This cut maps them to reproducible events, the precise model/application boundary, a concrete viewer need, a coherent user journey and Microsoft integration. These are presentation choices, not claims about judging outcomes. Best Use of Foundry remains a stretch without demonstrated incremental AI value; do not invent innovation or impact metrics to fill that gap.
