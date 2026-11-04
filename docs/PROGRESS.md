# Progress Log

Newest entry first. Every agent session adds an entry here (see `AGENTS.md` §5).

Template:

```
## YYYY-MM-DD — short title
**Done:** ...
**Not finished / known issues:** ...
**Next:** ...
```

---

## 2026-11-04 — Pushed to GitHub

**Done:** The user created `https://github.com/MiniRunRun/CTC_MiniGame` (GitHub username confirmed: `MiniRunRun`)
and cloned it. Local history was merged in and pushed. The working copy is the clone.
**Not finished / known issues:** GitHub Pages must be turned on (Settings → Pages → `main`, `/ (root)`).
Tech stack approval and the meaning of "CTC" are still open.
**Next:** Milestone 1 in `ARCHITECTURE.md` once the user approves.

## 2026-11-04 — Dropped the node editor

**Done:** User clarified: no node editor in the game; nodes were only for picturing the plan. Updated
`GAME_DESIGN.md`, `ARCHITECTURE.md`, `DECISIONS.md` and `AGENTS.md` to a slider panel + 3D preview.
**Not finished / known issues:** Same as the entry below (tech OK pending, repo not on GitHub, "CTC" unknown).
**Next:** Milestone 1 in `ARCHITECTURE.md` once the user approves.

## 2026-11-04 — Flower builder researched and planned

**Done:**
- Wrote the user's flower builder requirements into `docs/GAME_DESIGN.md` (parts, sliders, 4 architecture types, free drawing, Blender-node UI).
- Researched feasibility and wrote the technical plan in `docs/ARCHITECTURE.md`. Result: everything is doable in the browser.
- Added the tech choice and drawing approach to `docs/DECISIONS.md` (marked *proposed*).

**Not finished / known issues:**
- Tech choice waits for the user's OK.
- "CTC" meaning still unknown.

**Next:**
- After approval, start milestone 1 in `docs/ARCHITECTURE.md` (Vite + React + R3F skeleton, deploy to Pages).

## 2026-11-04 — Repository created

**Done:**
- Created the repo skeleton: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` (progress, decisions, game design), a placeholder `index.html`, `src/main.js`, `src/style.css`, `assets/`.
- Set up git locally (not pushed yet; GitHub repo not created).

**Not finished / known issues:**
- No game exists yet. `index.html` is a placeholder page.
- The game idea is not defined. `docs/GAME_DESIGN.md` is mostly empty.
- "CTC" meaning is not yet recorded — ask the user and write it in `docs/GAME_DESIGN.md`.
- GitHub Pages may need to be turned on: repo Settings → Pages → Source: `main` branch, `/ (root)`.

**Next:**
- Ask the user what the game should be, fill in `docs/GAME_DESIGN.md`, then build the first playable version.
