# GeorgiAI — Claude Code Skills

Claude Code plugin marketplace by [GeorgiAI](https://costeffective.software). One plugin, everything included.

## Install

One command in your terminal (installs everything):

```bash
claude plugin marketplace add georgiai1/georgiai-skills && claude plugin install georgiai@georgiai
```

Then enable auto-update so new versions arrive on their own: `/plugin` → **Marketplaces** → `georgiai` → **Enable auto-update**. New skills added to this repo ship as version bumps of the one plugin, so auto-update delivers them without any further installs.

Or from inside Claude Code:

```
/plugin marketplace add georgiai1/georgiai-skills
```

```
/plugin install georgiai@georgiai
```

## What's inside

### Commands — feedback workflow

Customer feedback rounds end-to-end, driven from ClickUp:

- **/feedback-prep** — pre-round clarification pass: reads feedback tickets, comments, screenshots, the BRD and the code, then posts one-word-answerable clarifying questions as ClickUp comments and flips those tickets to *update required*. Changes nothing in the product.
- **/feedback-round `<N>`** — runs round N: consolidates tickets under a parent, groups them into work packages by file overlap, resolves inter-ticket dependencies into waves, implements each package with parallel subagents, commits/ships per package, and syncs ClickUp statuses, the feedback DB table, the BRD change-log and project docs.

**Per-project setup (required):** both commands read a `## Feedback workflow` config section from the project's `CLAUDE.md` and stop with a template if it's missing. See [plugins/georgiai/README.md](plugins/georgiai/README.md).

### Skill — brd-architect

One-Shot BRD Architect: interviews a business owner about how their business actually runs and produces a single, build-ready BRD complete enough for a coding agent to build the whole system in one shot — no follow-up questions, no invented decisions, no gaps. Triggers on requests to write/review/improve a BRD, spec, or requirements document.

### Skill — nuxt

Nuxt 4+ development skill with reference docs (server routes, file-based routing, middleware, composables, config). Vendored snapshot of the MIT-licensed community `nuxt` agent skill, pinned here so the whole team runs the same version; refresh it by re-copying from upstream and bumping the version.

### Skill — fix-stale-mcp-oauth

Repairs MCP OAuth logins that fail on every attempt with `Unrecognized client_id` / `invalid_client` (the `/mcp` → Authenticate loop). Root cause: a stale cached Dynamic Client Registration in `~/.claude/.credentials.json` that the auth server no longer recognizes — the UI can't clear it and reinstalling the server doesn't help. The skill removes just that one cache entry (metadata-only inspection, backup, atomic write), then walks through the full-restart re-authentication.

## Contributing / updating

Everything lives under `plugins/georgiai/` — skills in `skills/<skill-name>/`, commands in `commands/`. To add or change anything: edit in place, bump `version` in both `.claude-plugin/marketplace.json` and `plugins/georgiai/.claude-plugin/plugin.json`, push to `main`. Installs with auto-update pick it up automatically.
