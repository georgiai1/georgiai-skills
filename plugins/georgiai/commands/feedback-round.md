---
description: Run a customer feedback round end-to-end — consolidate ClickUp tickets, implement via parallel subagents, sync ClickUp/Supabase/BRD, deploy
argument-hint: <round-number> [optional notes, e.g. "only the stock tickets"]
---

Run a full customer feedback round for the current project, autonomously.

## 0. Resolve project

- **Sync with the repo first, before anything else** (rounds run from more than one machine — local main may be behind): `git fetch`, then `git status` + `git log HEAD..origin/main --oneline`. If behind, `git pull --ff-only`. If the pull can't fast-forward, or there are local uncommitted/unpushed changes you didn't create this session, STOP and surface them to the user before touching anything — never rebase, merge, or stash someone else's work silently.
- Read `.claude/feedback-round.json` from the root of the repo this skill is invoked in:

```json
{
  "clickup_list_id": "901524746867",
  "project_name": "Lina Trade",
  "language": "bg",
  "supabase": { "project_ref": "hmimpcypnrifvsgnxenb", "bug_reports_table": "bug_reports" },
  "brd_doc_id": "2kyqtm8b-2995"
}
```

- `clickup_list_id` and `project_name` are required. `language` defaults to `en` — it governs all customer-facing text (ClickUp comments, parent summary, BRD headers). `supabase` and `brd_doc_id` are optional — skip any step below that uses a field the config doesn't have.
- If the file is missing: derive the project name (git remote → package.json name → folder name), fetch the ClickUp "Projects" space hierarchy (space id `90159111101` — one list per project; list names carry emoji prefixes, strip them before matching), fuzzy-match, **confirm the match with the user once**, then write `.claude/feedback-round.json` so future runs are deterministic. Never pick a list silently.

**Round number: $1** — an integer N naming everything in this round: the parent ticket (`Feedback N — DD.MM.YYYY`), the BRD change-log headers, the docs/status.md + docs/tasks.md sections ("round N"), and the conversation — set the session title to `Feedback N` (exactly that; via mcp session set_session_title) at the start. If $1 is missing or not an integer, infer N = highest existing round parent in the list + 1 — match both the `Feedback N` pattern and the legacy „Клиентска обратна връзка №N" parents — state the inferred number, and continue.

Full invocation arguments: `$ARGUMENTS` — the first token is the round number handled above; everything after it is free-form notes scoping this run (e.g. "only the stock tickets").

## 1. Collect & consolidate

- Fetch the project's ClickUp list (`clickup_list_id`) and find all **standalone** `REPORTED:` tickets in **to do** (exclude subtasks of previous round parents — check `parent`).
- Read each ticket's full markdown; if `supabase` is configured, also read its bug-reports row (the original title sometimes differs from the edited ClickUp name — both carry intent). Download and look at every screenshot.
- Create one parent ticket `Feedback N — DD.MM.YYYY` (priority high, status in progress). Its description is the scope table `# | Subtask | Area | Original` — one row per ticket: the subtask name, the page/module it touches, the original ticket id.
- Recreate each original as a subtask under the parent. The subtask name is `<Reporter>: <summary>` where:
  - `<Reporter>` is the person who reported it, exactly as the original ticket names them.
  - `<summary>` is written by you in the config `language` after reading the ticket + screenshot: the page/module plus the concrete outcome to build, the way a developer would title the work — e.g. `Ники: /vehicles/:id — при смяна на гума да може да се избере резервната` — not the reporter's raw words (raw titles are often one vague word).
  - Subtask body = full original markdown incl. screenshot URLs + a provenance line: original id, original title verbatim.
- Then delete the originals.
- If `supabase` is configured: immediately re-point the bug-reports table's `clickup_task_id` to the new subtask ids (otherwise status-comment DB triggers post into deleted tasks).
- If the ClickUp MCP connector is rate-limited, go straight to the REST API with `integration_secrets.clickup_token` (see the project's `feedback-round-<slug>` memory for endpoints/workspace ids).

## 2. Scope & group

- Investigate each ticket against the codebase and live DB before writing anything.
- Group tickets into **work packages by file overlap**, not one-agent-per-ticket blindly: tickets touching the same components become ONE package; truly independent tickets get their own package.
- Keep **DB migrations and data changes with the orchestrator** (main session) — agents don't apply migrations.
- A ticket that requires answering questions (owner decision, genuine ambiguity): don't implement — extract it from the round instead. It must end up as a **top-level task** in the list, NOT a subtask of the round parent: if it isn't consolidated yet, leave the original in place; if it already became a subtask, recreate it as a top-level task (keep its `<Reporter>: <summary>` name; full markdown + provenance line), delete the subtask copy, and re-point `clickup_task_id` to the new id (when `supabase` is configured). Then set its status to **update required** if the list has that status (check the list's configured statuses via get_list first; if not, leave it in **to do** and flag it in the comment), assign "Georgi AI" (member id 266686581), post a comment with the concrete questions and options, and keep its bug-reports row `open`. This applies whenever the questions surface — during scoping or mid-implementation.

## 3. Implement — subagent-driven, parallel

- Mark the affected subtasks **in progress** as their package starts.
- Dispatch **one background agent per package, all in parallel** (single message, multiple Agent calls). Use worktree isolation only if packages unavoidably overlap on files.
- Each agent's brief must include: exact ticket texts (original language), the files/areas it may touch (hard scope), the project conventions (existing patterns, UI copy language, tests next to code), what to verify (`npx vitest run <scope>`, `npm run typecheck`, `npm run lint` — or the project's equivalents), and **no commits, no dev servers**.
- On each agent's completion: review its diff yourself before accepting.
- After all packages land: run the **full** suite + typecheck once over the combined state, then commit **per ticket/package** with the subtask ids in the message, and push main (auto-deploy is pre-authorized).

## 4. Track & sync (per subtask, as it completes — not batched at the end)

- ClickUp: status → **complete** + an implementation comment in the config `language` (what/why/commit; call out anything the owner should review).
- If `supabase` is configured: bug-reports row status → `fixed`; anything not shipped stays/returns to `open`.

## 5. Wrap up

- If `brd_doc_id` is configured: append a dated change-log section to each affected BRD module page (header in the config `language`, e.g. bg: `## Изменения — DD.MM.YYYY (Feedback №N)`).
- Close the parent with a round summary + an explicit owner-review list (in the config `language`); link any tickets extracted to **update required** there (they live outside the parent, so the parent still closes cleanly once all remaining subtasks shipped).
- Update `docs/status.md` + `docs/tasks.md` (same format as previous rounds), commit, push.
- Verify live in the browser (find the real dev-server port — this project's may not be the only one running). If no logged-in session exists, say so and list what remains visually unverified — never enter credentials.
- Update the per-project memory `feedback-round-<project-slug>.md` (new parent id, anything learned); create it from the shared feedback-round-workflow memory on first run if it doesn't exist.
