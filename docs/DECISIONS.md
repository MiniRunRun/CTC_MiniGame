# Decisions

Why the project is built the way it is. Newest first. Add one entry per real choice.

Template:

```
## YYYY-MM-DD — decision
**Choice:** what was picked
**Why:** reason
**Alternatives considered:** ...
```

---

## 2026-11-04 — Plain HTML/CSS/JS, no build step

**Choice:** The game is plain static files served directly by GitHub Pages.
**Why:** Simplest setup. Nothing to install, nothing to build, and GitHub Pages can host it as-is.
Any agent can run it with one command.
**Alternatives considered:** Vite/React, Phaser via npm. Can be added later if the game needs it —
if so, record it here and update the run/publish steps in `AGENTS.md`.

## 2026-11-04 — Agent-readable docs in the repo

**Choice:** `AGENTS.md` + `docs/PROGRESS.md` + `docs/DECISIONS.md` + `docs/GAME_DESIGN.md`.
**Why:** The user asked that any future agent understands the project without access to past
conversations or agent memory. All context lives in the repo.
