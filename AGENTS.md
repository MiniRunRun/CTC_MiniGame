# AGENTS.md — Read This First

This file is for **any AI agent or new developer** working on this repository.
Assume you have **no memory** of past conversations. Everything you need to know
must be in this repository. If it isn't written here, it doesn't exist.

## 1. What this project is

- **Name:** CTC MiniGame
- **Owner:** MiniRunRun (GitHub)
- **Goal:** A small browser game, published with **GitHub Pages**.
- **Current status:** See [`docs/PROGRESS.md`](docs/PROGRESS.md). The top entry is the latest state.

## 2. Where things are

| Path | What it is |
|------|------------|
| `index.html` | Entry page. GitHub Pages serves this file at the site root. |
| `src/` | Game code (JavaScript, CSS). |
| `assets/` | Images, sounds, fonts. |
| `docs/PROGRESS.md` | Running log of what was done, newest first. **Always update.** |
| `docs/DECISIONS.md` | Why things were done a certain way. **Add an entry for every real choice.** |
| `docs/GAME_DESIGN.md` | What the game is: rules, controls, art style, goals. |
| `README.md` | Short public description for humans visiting the repo. |
| `CLAUDE.md` | Points Claude Code to this file. |

Keep this table up to date when you add or move folders.

## 3. How to run it

No build step. It's plain HTML/CSS/JS.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

If a build step is ever added, update this section with the exact commands.

## 4. How it gets published

- GitHub Pages serves the `main` branch from the repo root.
- Live site: `https://minirunrun.github.io/CTC_MiniGame/` (works once Pages is turned on in repo Settings → Pages).
- Pushing to `main` updates the site within about a minute.

## 5. Rules for every agent (mandatory)

These rules exist so the next agent can pick up without anyone explaining anything.

1. **Read before working:** read this file, `docs/PROGRESS.md`, and `docs/GAME_DESIGN.md` before changing code.
2. **Log every session:** add a new entry at the **top** of `docs/PROGRESS.md` with:
   - the date (YYYY-MM-DD),
   - what you changed (files and features),
   - what is **not** finished or is broken,
   - what should happen next.
3. **Record decisions:** whenever you pick between options (library, structure, mechanic, art style), add an entry to `docs/DECISIONS.md` with the reason.
4. **Keep design current:** if the user changes how the game should work, update `docs/GAME_DESIGN.md` in the same commit.
5. **No hidden context:** never rely on chat history or agent memory. If the user told you something important (a preference, a requirement, a name), write it into the docs.
6. **Comment code for humans:** short, plain comments that explain *why*, not just *what*. Each file in `src/` starts with a one-line comment saying what it does.
7. **Commit messages:** describe what changed and why in plain words. Commit docs together with the code they describe.
8. **Don't break the live site:** before pushing to `main`, open the page locally and check it loads with no console errors.

## 6. User preferences (known so far)

- The user writes in both Chinese and English. Reply in the language they use.
- The user wants the repository to be fully self-explanatory to future agents (that is why this file exists).
