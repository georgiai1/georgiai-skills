---
description: Run a customer feedback round end-to-end — consolidate ClickUp tickets, implement via parallel subagents, sync ClickUp/DB/BRD, deploy
argument-hint: <round-number> [optional notes, e.g. "only the stock tickets"]
---

Run a full customer feedback round for this project, autonomously.

**Round number: $1** — the first argument is an integer N; it names everything in this round: the parent ticket ("… №N …"), the BRD change-log headers ("… №N)"), the docs/status.md + docs/tasks.md sections ("round N"), and the conversation — set the session title to `Feedback N` (exactly that: the word "Feedback" + the number, no "round") at the start. If $1 is missing or not an integer, infer N (highest existing consolidated-round parent number in the list + 1), state the inferred number, and continue.

Full invocation arguments: `$ARGUMENTS` — the first token is the round number handled above; everything after it is free-form notes scoping this run (e.g. "only the stock tickets").

## 0. Project config — HARD GATE

Read the `## Feedback workflow` section of the `CLAUDE.md` **at this project's root** (or `.claude/feedback-workflow.md` in this project, if it exists). Global/user-level CLAUDE.md files and command arguments do NOT satisfy this gate — config from another project would point the run at the wrong client's list. It must define:

**Required:** `clickup_list` (list ID + name) · `feedback_table` (DB table holding filed feedback) · `ticket_id_column` (column linking a row to its ClickUp task) · `client_language` (language for all client-facing ticket text and comments) · `ai_assignee` (ClickUp member name + ID) · `verify_commands` (scoped test / typecheck / lint commands)

**Optional:** `brd_location` (where the BRD/spec lives) · `statuses` (defaults: `to do` / `update required` / `in progress` / `complete`) · `question_marker` (defaults to `❓` + "Questions before the round" in `client_language`) · `ticket_naming` (how synced feedback tickets are named) · `clickup_token_source` (REST token location for MCP rate-limit fallback) · `deploy` (how a push ships, e.g. "push main → auto-deploy"; without it, commit but ask before deploying) · `docs` (status/tasks files to update; defaults `docs/status.md` + `docs/tasks.md` if they exist)

If the config section is missing or any **required** key is absent: **STOP immediately.** In this state make no ClickUp/MCP/DB calls of any kind — not to "verify", not to pre-fill the template. Do not infer any key (not the list, not `client_language`, not deploy behavior), and do not write the config into `CLAUDE.md` yourself; the values must come from the user. Print the config template (same one `/feedback-prep` prints), ask the user to fill it into the project's `CLAUDE.md`, and end the run.

## 1. Collect & consolidate

- Fetch the configured ClickUp list and find all **standalone** feedback tickets in **to do** (exclude subtasks of previous round parents — check `parent`). The authoritative match is `feedback_table.ticket_id_column`: a standalone to-do task whose ID appears there is a feedback ticket, regardless of its name; use `ticket_naming` only as a secondary hint. Standalone to-do tickets with NO `feedback_table` row (created directly in ClickUp by the owner/team) are in scope too — consolidate them like any other; they simply have no DB row to read or sync.
- Read each ticket's full markdown, its **ClickUp comments and their threaded replies** (`clickup_get_task_comments` + `clickup_get_threaded_comments` / REST `GET /task/{id}/comment` + `GET /comment/{comment_id}/reply` — the plain task-comment endpoint does NOT return thread replies, and /feedback-prep's answers live exactly there), AND its `feedback_table` row (the original title sometimes differs from the edited ClickUp name — all three carry intent). Comments often hold context, answers and Q&A added after filing — treat them as part of the ticket's requirements. Download and look at every screenshot (incl. ones attached in comments).
- Also sweep tickets in **update required**: if the owner has answered the posted questions via comments, the ticket re-enters this round's scope (consolidate it like any other; the comment thread is the spec).
- Create one parent ticket `🗂️ <"Customer feedback" in client_language> №N — DD.MM.YYYY (<"consolidated ticket" in client_language>)` (priority high, status in progress) listing the scope. Then **convert** each original feedback ticket into a subtask of it **in place** — REST `PUT /api/v2/task/{id}` with body `{"parent":"<parentId>"}` (promoting a top-level task to a subtask returns HTTP 200 and sticks). **Do NOT recreate + delete.** Conversion keeps the task's ID, description, screenshot URLs, comments/Q&A and history intact, so there is nothing to copy over and nothing dies with a deleted task. The MCP tools can't do this (`clickup_update_task` has no `parent` field; `clickup_move_task` only changes lists) — use the REST API.
- Because conversion preserves the ID, `feedback_table.ticket_id_column` still points at the right task — **no re-pointing needed**, and any DB triggers keyed to it keep working. (Re-pointing is only required in the delete+recreate fallback — see §2 extraction.)
- If the ClickUp MCP connector is rate-limited, go straight to the REST API using the token from `clickup_token_source`.

## 2. Scope & group

- Investigate each ticket against the codebase and live DB before writing anything.
- Group tickets into **work packages by file overlap**, not one-agent-per-ticket blindly: tickets touching the same components become ONE package; truly independent tickets get their own package.
- **Dependencies first:** before finalizing packages, extract inter-ticket dependencies from BOTH sources: (a) ClickUp dependencies (`GET /api/v2/task/{id}` returns a `dependencies` array; an entry where this task is `task_id` and links a `depends_on` id means "this waits on that") and (b) explicit markers in ticket descriptions ("AFTER package X", "TOGETHER with … / ONE agent", "LAST", "waits on" — in `client_language` or English). Tickets marked "TOGETHER / ONE agent" MUST be one package. Lift ticket→ticket edges to package→package edges (any ticket dependency = package dependency), then topologically sort packages into **waves**: a wave = all packages whose dependencies have already shipped. A cycle in the graph = stop and ask the owner. Tickets with no edges behave exactly as before.
- Keep **DB migrations and data changes with the orchestrator** (main session) — agents don't apply migrations.
- A ticket that requires answering questions (owner decision, genuine ambiguity): don't implement — extract it from the round instead. It must end up as a **top-level task** in the list, NOT a subtask of the round parent. **Prefer catching these during scoping, before consolidation — then just leave the ticket top-level (never set its parent), no conversion, no re-pointing.** If it was already converted to a subtask (questions surfaced mid-implementation), you can't simply convert it back: the ClickUp API **cannot demote a subtask to top-level** — `PUT parent:null` returns 200 but is a silent no-op. So fall back to the delete+recreate path there: recreate it as a new top-level task (full markdown + provenance line), delete the subtask, and re-point `feedback_table.ticket_id_column` to the new ID. Then set its status to **update required**, assign `ai_assignee`, post a comment with the concrete questions and options (in `client_language`), and keep its `feedback_table` row `open`. This applies whenever the questions surface — during scoping or mid-implementation.

## 3. Implement — subagent-driven, parallel

- Mark the affected subtasks **in progress** as their package starts.
- Dispatch **wave by wave along the dependency graph** (§2): within a wave — one background agent per package, all of the wave's packages in parallel (single message, multiple Agent calls). A package starts the moment **its own** dependencies are committed & green — don't wait for unrelated packages of the previous wave. With no dependencies at all this degrades to a single parallel wave. Use worktree isolation only if packages unavoidably overlap on files.
- Each agent's brief must include: exact ticket texts (in `client_language`) **plus any comment/Q&A content that refines them**, the files/areas it may touch (hard scope), the project conventions (existing patterns, UI copy language, tests next to code), what to verify (the scoped `verify_commands`), and **no commits, no dev servers**.
- **Per package, the moment its agent completes — don't wait for the other packages:** review its diff yourself → run its scoped tests + typecheck → commit that package immediately (subtask IDs in the message) → push per the `deploy` config → **immediately run §4 for that package's subtask(s)**. Never accumulate staged work across packages: a concurrent session's commit can otherwise swallow a batched diff.
- After the **last** package lands, run the **full** suite + typecheck once over the combined state as a final guard; fix forward if a cross-package regression surfaces.

## 4. Track & sync — per subtask, the instant its package is committed (never batched)

Run this as the **last move of each package's §3 loop**, immediately after that package is committed & pushed. Do NOT collect the updates and apply them together at the end — each subtask flips the moment its own work ships:

- ClickUp: that subtask's status → **complete** + an implementation comment in `client_language` (what/why/commit; call out anything the owner should review).
- DB: `feedback_table.status` → `fixed` (synced tickets only — a direct ticket has no row); anything not shipped stays/returns to `open`.

## 5. Wrap up

- If `brd_location` is configured: append a dated change-log section (`## <"Changes" in client_language> — DD.MM.YYYY (<"customer feedback" in client_language> №N)`) to each affected BRD module page.
- Close the parent with a round summary + an explicit "for owner review" list in `client_language`; link any tickets extracted to **update required** there (they live outside the parent, so the parent still closes cleanly once all remaining subtasks shipped).
- Update the configured `docs` files (same format as previous rounds), commit, push.
- Verify live in the browser (find the real dev-server port via `lsof` — this project may not be the only one running). If no logged-in session exists, say so and list what remains visually unverified — never enter credentials.
- Update the project's feedback-workflow memory/notes if one is maintained (new parent ID, anything learned).
