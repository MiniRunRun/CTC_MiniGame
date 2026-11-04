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

## 2026-11-04 — Deploy with GitHub Actions, relative base path

**Choice:** `.github/workflows/deploy.yml` builds and deploys to Pages; `vite.config.ts` uses `base: "./"`.
**Why:** A Vite app must be built before Pages can serve it. A relative base works under the
`/CTC_MiniGame/` sub-path and locally without changes.
**Alternatives considered:** committing `dist/` to a `gh-pages` branch (manual, easy to forget).

## 2026-11-04 — No node editor in the game; slider panel instead

**Choice:** Players edit flowers with a slider panel (one section per part) beside a live 3D preview.
**Why:** The user said the Blender node look was only to help *them* picture the plan, not a player UI.
**Effect:** React Flow removed from the stack; node graphs are only used in diagrams explaining the design.

## 2026-11-04 — Tech for the 3D flower builder (approved by user, built in milestone 1)

**Choice:** Vite + React + TypeScript, three.js via React Three Fiber, zustand for state. (React Flow was in the
first draft; removed, see entry above.) Details in `ARCHITECTURE.md`.
**Why:** The user wants everything in 3D. R3F lets the 3D view share one React app and state with the slider panel.
**Alternatives considered:** Babylon.js, plain three.js + Tweakpane.
**Note:** this replaces the earlier "no build step" decision once approved. GitHub Pages will then be deployed by a
GitHub Actions workflow that runs the Vite build.

## 2026-11-04 — Free drawing = 2D outline turned into a bent 3D surface

**Choice:** Players draw a flat outline; sliders bend/cup/spread it into 3D. No free 3D sculpting.
**Why:** Drawing in 3D is hard for players and heavy to build. Real petals and leaves are thin curved sheets, so a
2D outline plus bending looks right and stays simple.

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
