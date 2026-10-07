# Fannan kickoff pack: start here

## What's in this folder

| File | For | What it is |
|---|---|---|
| `CLAUDE.md` | Claude Code | Project rules: the stack, the design rules, how to talk to you. Claude Code reads it automatically every session. |
| `docs/PLAN.md` | Claude Code | The build plan in 8 phases, each ending with something you can test. |
| `docs/ONBOARDING.md` | Claude Code | The Carbonmade-style sign-up flow, step by step. |
| `docs/PRICING.md` + `config/plans.json` | Claude Code | Free + prepaid Pro (3/6/12 months), EGP in Egypt, USD elsewhere. |
| `docs/CONTENT-POLICY.md` | Claude Code | What's allowed, what isn't, and the report tools. |
| `config/reserved-usernames.txt` | Claude Code | 270+ names nobody can claim. |
| `AHMED-TODO.md` | You | The checklist of accounts, decisions and tests only you can do. |
| `design/` | Claude Code | Brand book, colours and fonts (`tokens.json`), the 53 icons, and the reference screens (dashboard, editor, project, stats, settings, shapes, homepage EN/AR). |

## How to start

1. Accounts are ready (Google Cloud, Firebase, Cloudflare). Done ✓
2. Make an empty folder called `fannan` on your computer and put everything from this pack inside it.
3. Open Claude Code in that folder and paste this:

> Read CLAUDE.md, everything in docs/ and config/, and AHMED-TODO.md, and look through the design folder. Then start Phase 0. Before writing code, tell me in plain language what you're about to do and anything you need from me. Stop at the end of the phase and tell me how to test it.

4. After each phase: test on your phone and laptop, in English and Arabic, then tell Claude Code what's wrong or say "next phase".

## Tips

- One phase per session is a good rhythm. Start a new session with: "Read docs/PROGRESS.md and continue."
- If Claude Code asks you to choose something technical and you don't know, say "pick the simplest option and explain why".
- Never paste passwords or API keys into a chat that gets saved somewhere public. When Claude Code asks for a key, it will tell you where to put it safely.
- The reference screens are design files. `{{...}}` inside them are template slots, not mistakes.
