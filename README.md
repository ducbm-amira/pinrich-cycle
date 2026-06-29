# pinrich-suite

Pinrich/Amira dev-workflow skills, packaged as a single Claude Code plugin.

The suite is built around **`/pinrich-suite:pinrich-cycle`** — a thin orchestrator
that routes a task through the right sibling skills (context → build → review → QA →
design-fidelity). The skills are coupled (the orchestrator calls the others by name),
so they ship and install **together** as one plugin.

## Install

```text
/plugin marketplace add ducbm-amira/pinrich-cycle   # the repo hosting this plugin
/plugin install pinrich-suite@pinrich-suite
```

SSH instead? `/plugin marketplace add git@github.com:ducbm-amira/pinrich-cycle.git` works as
long as your `ssh-agent` (or git credential helper) can reach it.

After install, run the one-time setup (installs the qa-verify browser runtime and prints
what still needs configuring):

```text
pinrich-suite-setup
```

`pinrich-suite-doctor` re-checks prerequisites at any time. It also runs automatically
at session start and only prints warnings — it never blocks.

## Skills (all namespaced under `pinrich-suite:`)

| Skill | What it does |
|-------|--------------|
| `pinrich-cycle` | **Orchestrator** — drives a task through the lifecycle and routes to the skills below. Also the "which skill do I use?" front door. |
| `pinrich` | Loads Pinrich codebase + business context from memory. |
| `db` | Read-only exploration / queries against the Pinrich DB. |
| `bug-fix` | 4-phase bug/behavior-change workflow. |
| `sdd-port-page` | Port a legacy Vue page to the new Next.js SDD front end. |
| `design-screen` | Design-first flow for a UI screen via Claude Design → React. |
| `apply-design-handoff` | Apply a Claude Design handoff bundle into the real codebase. |
| `design-gap-audit` | Diff a customer design against the running app → gap table + questions. |
| `design-fidelity-check` | Run the fidelity gate (`python -m verdict`) → hard PASS/FAIL/BLOCKED verdict. |
| `review-code` | Pre-commit/PR code review across the Pinrich repos. |
| `qa-verify` | AI-driven manual QA with a headed Playwright browser. |

## Prerequisites (only some skills need these)

Most skills are pure workflow guidance and work out of the box. A few reach external
tooling — `pinrich-suite-setup` provisions what it can; configure the rest only if you
use those skills:

### `pinrich-cycle` — needs its helper scripts deployed
The orchestrator calls `dashboard.mjs` / `budget.mjs` / `verify-artifacts.mjs` (and keeps
per-repo state) at `~/.claude/pinrich-cycle/`. `pinrich-suite-setup` copies the bundled
`scripts/pinrich-cycle/*` there. Requires Node.js for the `dashboard` / `budget` subcommands.

### `qa-verify` — needs a Node + Playwright runtime
`pinrich-suite-setup` deploys the runtime to `~/.claude/skills/qa-verify/runtime/` (the path
the skill bootstraps from) and runs `npm install` + `npx playwright install chromium` there.
Requires Node.js on your `PATH`.

### `design-fidelity-check` — needs the external gate + a Python venv
This skill shells out to the `design-fidelity-gate` repo (the Phase 1–4 measurement
engine) and the `uat-toolkit` Python venv. They are **not** bundled here. Point the skill
at your checkouts via two env vars (add to your shell profile):

```bash
export PINRICH_GATE_DIR=/path/to/design-fidelity-gate
export PINRICH_GATE_PY=/path/to/uat-toolkit/.venv/bin/python
```

If unset, the skill fails fast with a clear message rather than running against the wrong
paths.

### Memory — `pinrich` and `db` expect project memory files
These two read machine/project-specific memory (codebase map, repo layout, infra routing,
DB access). Those files are **not** shipped (they are environment-specific and may contain
internal infra detail). Build your own under your Claude memory directory, or use the
skills in "search the codebase live" mode without memory (degraded but functional).

## Notes / limitations (v0.1.0)

- First cross-machine export. Validated structurally; not yet battle-tested on a fresh
  teammate machine — expect to iterate on the prerequisite scripts.
- The skills carry Pinrich/Amira business context in their prose (repo names, infra
  references). Intended for **internal** distribution.
- The "inject cycle state every session" behaviour from the original setup is **not** wired
  by this plugin's SessionStart hook (it only runs `pinrich-suite-doctor`). The `dashboard` /
  `budget` / `verify-artifacts` subcommands work after `pinrich-suite-setup`; auto-state-on-
  session-start needs a manual hook in your own `settings.json` if you want it.
