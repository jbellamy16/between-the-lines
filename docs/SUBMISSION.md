# Between the Lines: submission summary

Portal-ready text for the Inside the Game hackathon entry. Replace the bracketed items before submitting.

- **Project:** Between the Lines
- **Tagline:** More than the score.
- **Live app:** https://between-the-lines-jb-f5539b65.azurewebsites.net/ (free, no login)
- **Repository:** https://github.com/jbellamy16/second-look
- **Demo video:** [YouTube link]
- **Categories:** Grand Prize; Best Use of Microsoft Foundry

## Elevator pitch

Between the Lines is a second-screen match companion that tells you what's changing in a football match and proves it. It surfaces the few developments that matter, plots the evidence on a live pitch, and lets you ask an AI analyst anything. The analyst is a Microsoft Foundry agent that investigates with evidence tools, and every number, time and name it writes is checked against the recorded events before you see it.

## The problem

Fans join matches late, follow on their phones, or want more than the scoreline. Stats panels give numbers without a story; commentary gives a story you can't check. Broadcasters and streaming apps need explanations that are fast, personal and trustworthy enough to put on screen.

## What it does

1. **Ingest:** a seeded, football-realistic synthetic event feed of two fictional clubs.
2. **Interpret:** cutoff-safe statistics and equal-window pattern detection, so a "surge" is always compared with the equal spell before it.
3. **Explain:** story cards that lead with what changed, why it matters and the moments behind it (supporting and challenging evidence and what to watch next sit under Details), plus **Ask the Analyst**, a Foundry agent that answers free-text questions with grounded facts and replayable evidence. Its starter questions come from the story: a checked answer appears instantly and the agent adds to it.
4. **Render:** a responsive match centre with an interactive SVG pitch, sequence replay, recaps, lineups and player maps.
5. **Personalize:** Casual Viewer, Football Fan or Advanced Analysis wording over the same verified facts, plus favorite team and player.

## Microsoft and Azure technology

- **Microsoft Foundry:** a GPT-5.4 Mini deployment powers the analyst agent through the Responses API with function calling. The agent chooses among nine read-only evidence tools, calls them in parallel, revises once if the grounding check rejects its answer, and streams each step to the viewer.
- **Azure App Service:** hosts the Next.js app.
- **GitHub:** public source, pull-request history and Actions CI (type checks, unit tests, Playwright with accessibility checks on desktop and mobile viewports).

## Why the agent design matters

The agent is free to decide what to investigate and how to phrase the answer. It is not free to invent facts. Application code owns the data, enforces the viewer's match clock (so nothing is spoiled), and runs a deterministic grounding check on every answer. When the events can't answer a question, such as "is the manager angry?", the agent says so instead of guessing. Every model call also reserves its worst-case cost against a dollar ceiling, so the public demo can stay on for judges without runaway spend.

In three runs of the 18-question eval against the Foundry deployment (54 questions), an answer took a median of about 4 seconds from question to checked answer, never more than 6.5, and cost about $0.006 at retail rates.

## Broadcasters plug this in

Between the Lines is also an engine. Its evidence tools are published as a read-only MCP server, so a broadcaster's or club's own agent, or GitHub Copilot in VS Code, can connect and work the match through the same tools the analyst uses: score and goals, equal-window comparisons, shot maps, build-up traces and counter-evidence. The connection fixes the match time, so nothing later can leak into an in-play segment, and out-of-range queries are refused with a reason the agent can act on. The server runs no model, so calls cost nothing, and each client is rate limited.

## How to test it

1. Open the live app. It starts at 63:24 with Harbor leading 1–0.
2. Read the story card: Harbor have taken 4 shots after none in the equal spell before.
3. Drag the timeline back to about 59:00 and press play. Each time the story starts or changes, a moment card slides in with the minute and what changed. Tap one: playback pauses, jumps to that minute, replays the evidence on the pitch and opens the analyst with that moment's checked answer, then the agent adds to it. Missed a card? **Moments** lists every one so far, and none from after your position.
4. Under **Ask the analyst**, tap a starter question: the checked answer appears at once, then the agent adds to it. Or type your own, for example "Is Riverside doing anything about it?" Watch the agent's steps, then select a cited moment to replay it on the pitch.
5. Ask something the events can't answer, such as "Is the manager angry?", and see it decline.
6. Open **Details** to switch the explanation level, then drag the timeline to see the story change.
7. Optional: connect any MCP client (in VS Code, **MCP: Add Server**, HTTP) to `https://between-the-lines-jb-f5539b65.azurewebsites.net/api/mcp?t=77:00` and ask the agent to catch you up. Ask what happens after 80:00: the tools refuse, because at 77:00 it hasn't happened yet.

## Honest limits

The data is synthetic and simplified. "xG" is the generator's shot probability, not a trained model. The grounding check catches invented numbers, times and names, but answer usefulness has not been measured with viewers.
