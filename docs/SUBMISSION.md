# Between the Lines: submission summary

Portal-ready text for the Inside the Game hackathon entry.

- **Project:** Between the Lines
- **Tagline:** More than the score.
- **Live app:** https://between-the-lines-jb-f5539b65.azurewebsites.net/ (free, no login)
- **Repository:** https://github.com/jbellamy16/between-the-lines
- **Demo video:** https://www.youtube.com/watch?v=Es15jxE2PXU
- **Categories:** Grand Prize; Best Use of Microsoft Foundry; Best Enterprise Solution

## Elevator pitch

Between the Lines is a second-screen match companion that tells you what's changing in a football match and proves it. It surfaces the few developments that matter, plots the evidence on a live pitch, and lets you ask an AI analyst anything. The analyst is a Microsoft Foundry agent that investigates with evidence tools, and every number, time and name it writes is checked against the recorded events before you see it. Nothing is pre-recorded: the analyst answers whatever the viewer asks, live, at their point in the match. The same tools are published as an MCP server, so a broadcaster's own agent can use them too.

## The problem

Fans join matches late, follow on their phones, or want more than the scoreline. Stats panels give numbers without a story; commentary gives a story you can't check. Broadcasters and streaming apps want explanations that are fast, personal and trustworthy enough to put on screen, and an AI that invents a statistic on air is worse than no AI at all.

## What it does

1. **Ingest:** a seeded, football-realistic synthetic event feed of two fictional clubs.
2. **Interpret:** cutoff-safe statistics and equal-window pattern detection, so a "surge" is always compared with the equal spell before it.
3. **Explain:** story cards that lead with what changed, why it matters and the moments behind it, plus **Ask the Analyst**, a Foundry agent that answers free-text questions with grounded facts and replayable evidence.
4. **Render:** a responsive match centre with an interactive SVG pitch, sequence replay, live moment cards, recaps, lineups, player maps and pass-quality stats (average pass length, progressive and long passes).
5. **Personalize:** Casual Viewer, Football Fan or Advanced Analysis wording over the same verified facts, plus favorite team and player.

## Against the judging criteria

| Criterion                        | What to look at                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technological implementation     | A seeded synthetic generator produces football-realistic possessions (role-aware passing, carries, shots with distance-based chance values, recoveries, a substitution) across three reproducible scenarios. One playback clock bounds every view, tool and answer, so nothing after the viewer's position can leak. The server rebuilds the match itself and never trusts figures from the browser. More than 700 unit tests and a Playwright suite with accessibility checks (desktop and two phone sizes) run on every push. Every model call reserves its worst-case cost against a dollar ledger before it is sent. |
| Agentic design and innovation    | The agent decides what to investigate: it chooses among nine read-only evidence tools, calls them in parallel, and streams each step to the viewer. A deterministic grounding check (pure code, no model) verifies every number, match time and player name against what the tools returned, ties each count to the window it describes, and rejects predictions, feelings and guesses. A failed check sends the agent back once with the reasons; a second failure shows nothing.                                                                                                                                       |
| Real-world impact                | Built for the late joiner and the second screen. A question costs about $0.006 and repeated questions are cached, so it is cheap enough to run at broadcast scale (see below). The MCP server lets a broadcaster's or club's own agent use the same bounded tools without rebuilding them.                                                                                                                                                                                                                                                                                                                               |
| User experience and presentation | Live moment cards arrive as the story changes; tapping one replays the evidence on the pitch and opens the analyst with a checked answer. Three explanation levels share one set of facts. Desktop gets a player-style layout; phones keep controls in thumb reach.                                                                                                                                                                                                                                                                                                                                                      |
| Category adherence               | Ingest, interpret, explain, render and personalize, all on synthetic, football-realistic data, with Microsoft Foundry running the agent and Azure App Service hosting it.                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Microsoft and Azure technology

- **Microsoft Foundry:** a GPT-5.4 Mini deployment runs the analyst agent through the Responses API with function calling and structured output. Foundry is also how the agent is managed and judged, not only run: Foundry Evaluations scored its answers and drove fixes, and the AI Red Teaming Agent attacked it (see Evidence). The agent picks tools, revises when the grounding check rejects its answer, and declines when the events can't answer.
- **Azure App Service:** hosts the Next.js app and the MCP endpoint.
- **Azure Application Insights:** request, error and timing telemetry for the app and the MCP endpoint, with a daily data cap. Question text is never recorded.
- **MCP and GitHub Copilot:** the evidence tools are an MCP server that GitHub Copilot in agent mode can drive directly.
- **GitHub:** public source and Actions CI.

## Evidence

- **Accuracy.** The analyst is evaluated on 12 match questions and 6 it should decline (the manager's mood, the future, an unrelated player, a prompt-injection attempt). The last five runs against the Foundry deployment all scored 18/18, and every number, time and name in the final run was re-checked by hand against the recorded events.
- **Independent check in Microsoft Foundry.** Foundry Evaluations scores the analyst's answers with Microsoft's Groundedness, Relevance and Coherence evaluators on a separate model deployment, and the runs are logged to the Foundry project. Groundedness has scored 4.2 to 4.8 out of 5. The judge also found defects the deterministic check cannot see, such as a player named in a passing move he was not part of, and each one was fixed in the agent's instructions. It still flags about one answer in twelve. [Details](ANALYST.md#evaluate-it-in-microsoft-foundry)
- **Attacked with Microsoft's Red Teaming Agent.** Foundry's AI Red Teaming Agent sent hateful, violent, sexual, self-harm and sensitive-inference attacks, including jailbreak templates, past tense, leetspeak and base64. None of 165 judged attacks got a harmful reply: 98 were declined and 1 got an ordinary match fact. A question length limit stopped 66 before any model saw them, so this shows safety in depth, not model strength alone. It doesn't test whether answers stay grounded; the evaluation above does that. [Details](ANALYST.md#attack-it-with-microsofts-red-teaming-agent)
- **Speed.** Across those 90 questions the median answer took about 4 seconds from question to checked answer, using one or two model requests. All but one finished within 7.5 seconds.
- **Cost.** About $0.006 per question at retail rates. An identical question at the same match time is answered from cache for an hour at no cost.

## Ready for production

The controls a broadcaster or streaming platform would ask for are already in the live app:

- **Reliability.** Every view, tool and answer is bounded by the viewer's match clock. If the model, the usage store or any limit fails, the app falls back to the deterministic story; it never shows an unchecked answer.
- **Transparency.** Each answer shows the steps the agent took, and every claim links to the recorded moments behind it, replayable on the pitch.
- **Cost control.** Every model call reserves its worst-case cost against a dollar ceiling before it is sent, with per-minute, hourly, daily and per-client caps on top. At $0.006 a question, 100,000 viewers asking three questions each during a match would cost under $2,000 before caching.
- **Operations.** CI runs type checks, unit tests and browser tests with accessibility checks on every push, and one release script builds a clean package, scans it for secrets, deploys it and verifies the live app.

Between the Lines is also an engine. Its evidence tools are a read-only MCP server, so a broadcaster's assistant, a production team's Copilot or a club data desk can work the match through the same tools the analyst uses: score and goals, equal-window comparisons, shot maps, build-up traces and counter-evidence. The connection fixes the match time, so nothing later can leak into an in-play segment, and out-of-range queries are refused with a reason the agent can act on. The server runs no model, so calls cost nothing.

## Adoption path

A broadcaster or streaming platform can adopt it in three steps, each usable on its own.

1. **Connect an agent today.** Point any MCP client (a production team's Copilot, a club data desk's assistant) at `/api/mcp?t=<match time>`. It needs no model, no key and no setup, and costs nothing to run. The connection fixes the match time, so an in-play segment can't be spoiled.
2. **Put your own feed behind it.** Everything reads one canonical event model (passes, shots, carries, recoveries, substitutions, with coordinates and periods), and every match is validated against it before any story, tool or answer is built. Supporting a new feed means writing one adapter that returns that model. The detectors, evidence tools, grounding check and UI don't change.
3. **Run the analyst on your own Azure.** The analyst is a Microsoft Foundry deployment plus App Service settings: a dollar ceiling, request caps per minute, hour, day and client, and a shared usage store. Turning it off, or hitting any limit, falls back to the deterministic story. [Setup](ANALYST.md#turn-it-on-in-azure)

At about $0.006 a question, and nothing for repeats of the same question at the same moment, the cost scales with what viewers ask rather than with audience size.

Before real traffic the MCP endpoint needs authentication, which a public demo doesn't have; the per-client rate limit is its only protection today.

## How to test it

1. Open the live app. It starts at 63:24 with Harbor leading 1–0.
2. Read the story card: Harbor have taken 4 shots after none in the equal spell before.
3. Drag the timeline back to about 59:00 and press play. Each time the story changes, a moment card slides in. Tap one: playback pauses, the evidence replays on the pitch, and the analyst opens with that moment's checked answer.
4. Under **Ask the analyst**, type your own question, for example "Is Riverside doing anything about it?" Watch the agent's steps, then select a cited moment to replay it.
5. Ask something the events can't answer, such as "Is the manager angry?" or "What happens in the 80th minute?", and see it decline.
6. Open **Details** to switch the explanation level, then drag the timeline to see the story change.
7. Optional: connect any MCP client (in VS Code, **MCP: Add Server**, HTTP) to `https://between-the-lines-jb-f5539b65.azurewebsites.net/api/mcp?t=77:00` and ask Copilot to catch you up. Ask what happens after 80:00: the tools refuse, because at 77:00 it hasn't happened yet.

## Honest limits

The data is synthetic and simplified, and "xG" is the generator's shot probability, not a trained model. The grounding check verifies each fact against the evidence; it can't judge whether an answer is the most insightful one, which only viewers can tell us. Answers are in English only: the grounding check reads English wording, and another language would need its own check before we'd show it.
