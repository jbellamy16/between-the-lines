<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hackathon submission brief (through Oct 27, 2026)

Goal: win the Inside the Game hackathon (Grand Prize + Best Use of Microsoft Foundry). Optimize for what judges see: the live app and a video under 2 minutes.

- Every PR maps to one item in the submission roadmap. No item, no PR.
- No new evaluation harnesses, receipts, ledgers, audit docs or dated `docs/` folders. History lives in git.
- Spending is pre-approved within the dollar ledger: two $15 ledgers (`AI_SPEND_LEDGER=test` locally, `production` on Azure) enforced in `src/lib/ai/spend-ledger.ts`. Do not ask for per-call approval and do not build new spend-control infrastructure.
- Docs: README, `docs/SUBMISSION.md` and `docs/ANALYST.md` only, product-first. One short Limits section. No PR numbers or commit hashes in user-facing docs.
- UI copy: state limits once, plainly. At most one caveat line visible by default; the rest goes behind a disclosure.
- Ask the Analyst (`src/lib/ai/analyst/`) is the AI centerpiece. Never weaken the grounding check to make an answer pass; improve the tools or the prompt instead.
- Keep tests green; add tests only for new behavior.
- Historical/real-data modes stay disabled and out of the submission (rules require synthetic data).
