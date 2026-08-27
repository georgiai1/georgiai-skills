# Cost Effective — Claude Code Skills

Claude Code plugin marketplace with the skills and commands we use at [Cost Effective Software](https://costeffective.software).

## Install

One command in your terminal (installs everything):

```bash
claude plugin marketplace add georgiai1/costeffective-skills && claude plugin install feedback-workflow@costeffective-skills && claude plugin install brd-architect@costeffective-skills && claude plugin install nuxt@costeffective-skills
```

Then enable auto-update so new versions arrive on their own: `/plugin` → **Marketplaces** → `costeffective-skills` → **Enable auto-update**.

Or from inside Claude Code:

```
/plugin marketplace add georgiai1/costeffective-skills
```

```
/plugin install feedback-workflow@costeffective-skills
```

Updates ship when this repo updates — refresh via `/plugin` → Manage marketplaces → update, then update the installed plugin.

## Plugins

### feedback-workflow

Customer feedback rounds end-to-end, driven from ClickUp:

- **/feedback-prep** — pre-round clarification pass: reads feedback tickets, comments, screenshots, the BRD and the code, then posts one-word-answerable clarifying questions as ClickUp comments and flips those tickets to *update required*. Changes nothing in the product.
- **/feedback-round `<N>`** — runs round N: consolidates tickets under a parent, groups them into work packages by file overlap, resolves inter-ticket dependencies into waves, implements each package with parallel subagents, commits/ships per package, and syncs ClickUp statuses, the feedback DB table, the BRD change-log and project docs.

**Per-project setup (required):** both commands read a `## Feedback workflow` config section from the project's `CLAUDE.md` and stop with a template if it's missing. See [plugins/feedback-workflow/README.md](plugins/feedback-workflow/README.md).

### brd-architect

One-Shot BRD Architect skill: interviews a business owner about how their business actually runs and produces a single, build-ready BRD complete enough for a coding agent to build the whole system in one shot — no follow-up questions, no invented decisions, no gaps. Triggers on requests to write/review/improve a BRD, spec, or requirements document.

### nuxt

Nuxt 4+ development skill with reference docs (server routes, file-based routing, middleware, composables, config). Vendored snapshot of the MIT-licensed community `nuxt` agent skill, pinned here so the whole team runs the same version; refresh it by re-copying from upstream and bumping the version.

## Contributing / updating

Skills live under `plugins/<plugin-name>/`. Bump the plugin's `version` in `.claude-plugin/marketplace.json` and `plugin.json` when changing behavior, then push to `main`.
