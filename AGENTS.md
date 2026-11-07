# AGENTS.md — Read This First

This file is for **any AI agent or new developer** working on this repository.
Assume you have **no memory** of past conversations. Everything you need to know
must be in this repository. If it isn't written here, it doesn't exist.

## 1. What this project is

- **Name:** CTC MiniGame
- **Owner:** MiniRunRun (GitHub)
- **Goal:** A *Digital Garden* browser minigame, published with **GitHub Pages**. First feature: a 3D flower building tool (slider panel + live 3D preview).
- **Current status:** See [`docs/PROGRESS.md`](docs/PROGRESS.md). The top entry is the latest state.

## 2. Where things are

| Path | What it is |
|------|------------|
| `index.html` | Vite entry page; loads `src/main.tsx`. |
| `src/main.tsx`, `src/App.tsx` | React entry and top-level layout (panel + 3D view). |
| `src/plant/` | Pure flower logic, no React. Pipeline: `spec.ts` (settings + defaults) → `layout.ts` (where flowers/buds/leaves/branches go, per architecture) → `assemble.ts` (one Matrix4 per copy of each part). Geometry builders: `blade.ts` (shared bendable sheet), `build.ts` (Form → Build: rebuilds any part from pieces — primitives or fused — along its surface), `fused.ts` (SDF melting + whole fused flower), `ramp.ts` (shared ramp/ping-pong helpers), `profile.ts` (drawing → width profile), `petal.ts`, `leaf.ts`, `sepal.ts` (sepals + buds), `center.ts`, `stem.ts` (curves + tapered tubes). |
| `src/state/store.ts` | zustand store holding the current `PlantSpec` (`spec.parts[part]` = shape / build / color / material / animation). Panel writes with `setPart` / `update`, scene reads. |
| `src/ui/` | 2D interface: `Panel.tsx` (sections per part), `controls.tsx` (Slider, Choice, ColorPicker), `DrawPad.tsx` (drawing pad for drawn shapes). |
| `src/scene/` | 3D: `Viewport.tsx` (camera, lights, ground, controls) `parts.ts` (registry of every drawn mesh: source geometry, axis, copies, animation kind), `Plant.tsx` (runs the same pipeline for each registry entry and draws it as one `InstancedMesh`), `partMaterial.ts` (a part's material settings → natural / pearl / dream / glitch three.js materials), `matcap.ts` (paints the Pearl "lit ball" texture), `dreamMaterial.ts` (Dream shader + halo shell), `glitchMaterial.ts` (Glitch shader: grey levels, stripes, accents), `animation.ts` (motion injected into any material: one per-part motion — sway / pulse / glitch tearing — plus whole-plant glitch), `glsl.ts` (shared shader snippets: hash, noise, ramp, ping-pong, part color), `partColor.ts` (Material → Color: one ramp per part, injected into every material), `shaderPatch.ts` (stacks onBeforeCompile patches), `Effects.tsx` (screen effects after the 3D render, e.g. Dream). |
| `src/styles.css` | Global styles. |
| `assets/` | Images, sounds, fonts. |
| `vite.config.ts`, `tsconfig.json`, `package.json` | Build setup. |
| `.github/workflows/deploy.yml` | Builds and publishes to GitHub Pages on every push to `main`. |
| `.claude/launch.json` | Dev server config for Claude's preview browser. |
| `docs/PROGRESS.md` | Running log of what was done, newest first. **Always update.** |
| `docs/DECISIONS.md` | Why things were done a certain way. **Add an entry for every real choice.** |
| `docs/GAME_DESIGN.md` | What the game is: rules, controls, art style, goals. |
| `docs/ARCHITECTURE.md` | How it is built: tech stack, node types, how each flower part becomes 3D, build order. |
| `docs/WORKFLOW_PLAN.md` | Proposed restructure (one 6-stage pipeline per part) and its phases. Check status before refactoring. |
| `README.md` | Short public description for humans visiting the repo. |
| `CLAUDE.md` | Points Claude Code to this file. |

Keep this table up to date when you add or move folders.

## 3. How to run it

Vite + React + TypeScript + React Three Fiber. Needs Node.js 22+.

```bash
npm install        # first time only
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build into dist/
```

The build warns that the JS bundle is over 500 kB. That is expected (three.js). Ignore unless it grows a lot.

If the dev page goes blank with "Invalid hook call" in the console after adding a new library: stop the dev
server, delete `node_modules/.vite`, start again, and add the library to `optimizeDeps.include` in `vite.config.ts`.

## 4. How it gets published

- Repo: https://github.com/MiniRunRun/CTC_MiniGame
- `.github/workflows/deploy.yml` runs `npm run build` and publishes `dist/` on every push to `main`.
- One-time repo setting: Settings → Pages → Source: **GitHub Actions**.
- Live site: https://minirunrun.github.io/CTC_MiniGame/
- `vite.config.ts` uses `base: "./"` so asset paths work under the `/CTC_MiniGame/` sub-path. Don't change it.

## 5. Rules for every agent (mandatory)

These rules exist so the next agent can pick up without anyone explaining anything.

1. **Read before working:** read this file, `docs/PROGRESS.md`, `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` before changing code.
2. **Log every session:** add a new entry at the **top** of `docs/PROGRESS.md` with:
   - the date (YYYY-MM-DD),
   - what you changed (files and features),
   - what is **not** finished or is broken,
   - what should happen next.
3. **Record decisions:** whenever you pick between options (library, structure, mechanic, art style), add an entry to `docs/DECISIONS.md` with the reason.
4. **Keep design current:** if the user changes how the game should work, update `docs/GAME_DESIGN.md` in the same commit.
5. **No hidden context:** never rely on chat history or agent memory. If the user told you something important (a preference, a requirement, a name), write it into the docs.
6. **Comment code for humans:** short, plain comments that explain *why*, not just *what*. Each file in `src/` starts with a one-line comment saying what it does.
9. **Check the build:** run `npm run build` before committing; it must pass.
7. **Commit messages:** describe what changed and why in plain words. Commit docs together with the code they describe.
8. **Don't break the live site:** before pushing to `main`, open the page locally and check it loads with no console errors.

## 6. User preferences (known so far)

- The user writes in both Chinese and English. Reply in the language they use.
- The user wants the repository to be fully self-explanatory to future agents (that is why this file exists).
- The user likes **Blender-style node diagrams** for picturing plans and data flow. Use them when explaining structure to the user. **Do not** build a node editor into the game; players use a slider panel.
- Everything in the flower builder must be **3D**.
