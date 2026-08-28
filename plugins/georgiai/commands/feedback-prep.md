---
description: Pre-round clarification pass — sweep ALL open tickets (synced feedback + ones created directly in ClickUp), check how far each already is in the code, post questions with recommended answers and stated assumptions so /feedback-round runs on a full spec
argument-hint: [optional notes, e.g. "only the stock tickets"]
---

Prepare the next customer feedback round for this project by asking clarifying questions BEFORE any implementation. This command changes nothing in the product: no parent ticket, no consolidation, no code, no commits, no migrations, no BRD edits. Its only outputs are ClickUp comments (questions and stated assumptions), status flips to **update required**, and a summary in chat.

Set the session title to `Feedback prep` at the start. `$ARGUMENTS` (if any) is free-form notes scoping this run (e.g. "only the stock tickets").

## 0. Project config — HARD GATE

Read the `## Feedback workflow` section of the `CLAUDE.md` **at this project's root** (or the file `.claude/feedback-workflow.md` in this project, if it exists). Global/user-level CLAUDE.md files and command arguments do NOT satisfy this gate — config from another project would point the run at the wrong client's list. It must define:

**Required:** `clickup_list` (list ID + name) · `feedback_table` (DB table holding filed feedback, e.g. `bug_reports`) · `ticket_id_column` (column linking a row to its ClickUp task, e.g. `clickup_task_id`) · `client_language` (language for all client-facing comments) · `ai_assignee` (ClickUp member name + ID to assign question tickets to)

**Optional:** `brd_location` (where the BRD/spec lives — ClickUp doc, wiki, or repo path) · `statuses` (defaults: `to do` / `update required` / `in progress` / `complete`) · `question_marker` (defaults to `❓` + "Questions before the round" translated to `client_language`) · `ticket_naming` (how synced feedback tickets are named) · `clickup_token_source` (where a REST API token lives for when the MCP connector is rate-limited)

If the config section is missing or any **required** key is absent: **STOP immediately.** In this state make no ClickUp/MCP/DB calls of any kind — not to "verify", not to pre-fill the template. Do not infer any key (not the list, not `client_language`, not `ai_assignee`), and do not write the config into `CLAUDE.md` yourself; the values must come from the user. Print the template below, ask the user to fill it into the project's `CLAUDE.md`, and end the run.

```markdown
## Feedback workflow
- clickup_list: <LIST_ID> ("<list name>")
- feedback_table: <table>
- ticket_id_column: <column>
- client_language: <language>
- ai_assignee: "<name>" (<member id>)
- brd_location: <doc/wiki/path>          # optional
- statuses: to do / update required / in progress / complete   # optional
- question_marker: "❓ <marker text>"     # optional
- ticket_naming: <convention notes>       # optional
- clickup_token_source: <where>           # optional
```

## 1. Collect

- Fetch the configured ClickUp list and collect **every standalone ticket** in **to do** — exclude round parents (🗂️/consolidated naming) and subtasks of them (check `parent`). Classify each collected ticket:
  - **Synced** — its ID appears in `feedback_table.ticket_id_column` (filed through the app; authoritative regardless of name — use `ticket_naming` only as a secondary hint).
  - **Direct** — no `feedback_table` row: created straight in ClickUp by the owner or team. These are fully in scope — they are usually the vaguest and benefit most from this pass. Everything below applies to them; only the DB-row reads and expectations don't.
- Also include tickets in **update required**: if their posted questions are still unanswered, only check whether NEW questions have appeared (don't re-ask) and note how long they've been waiting (shown in §5); if answered, verify the answers actually close the ambiguity — leftover or follow-up questions get asked now, so the ticket doesn't bounce again mid-round.
- Standalone tickets stuck in **in progress** (usually leftovers of an interrupted round) get no comment — but run §2's progress check on them and list them in §5 with their real code state, so nothing silently rots.
- For each ticket read ALL of: full markdown, **ClickUp comments AND their threaded replies** (`clickup_get_task_comments` + `clickup_get_threaded_comments` / REST `GET /task/{id}/comment` + `GET /comment/{comment_id}/reply` — the plain task-comment endpoint does NOT return thread replies, and answers are expected exactly there), the `feedback_table` row (synced tickets), and every screenshot (incl. ones attached in comments or replies). Comments are part of the spec — answers may already be there.
- If the ClickUp MCP connector is rate-limited, go straight to the REST API using the token from `clickup_token_source`.

## 2. Context & progress

- Read the BRD/spec pages relevant to each ticket, **including any dated change-log sections from past rounds** — they record decisions already made; never ask something the BRD already answers. If `brd_location` is not configured, search the ClickUp workspace docs for the BRD before falling back to repo docs; name in the summary which pages were used.
- Investigate the codebase and live DB (read-only) enough to make each question concrete: name the actual screen/field/behavior and what the code does today, so the answer can be one word.
- **Progress check — where each ticket actually stands.** ClickUp status is not the truth; the code is. For each ticket, search the codebase, git history (`git log -S`, recent round commits) and the BRD change-log for the screens/behaviors it names, then classify:
  - **not started** — nothing in code addresses it;
  - **partially implemented** — name exactly what exists and what's missing;
  - **appears already implemented** — name the commit/round that shipped it.
  This state drives §3's questions and the §5 summary.

## 3. Generate questions & assumptions

- Ask a **blocking question** only for genuine ambiguity or owner decisions: conflicting requirements (including **conflicts between two open tickets**), **duplicate/overlapping tickets** (propose which one survives and what merges into it), missing business rules, multiple plausible UX interpretations, data whose meaning only the owner knows, a ticket that **appears already implemented** (ask to confirm & close instead of silently re-doing it), or one **partially implemented** where the remaining scope is unclear.
- Do NOT ask: anything answerable from code/DB/BRD/screenshots/comments; pure implementation choices; confirmation of the obvious.
- **Every question is grounded:** one short line on what the app does today and/or what the BRD says, then numbered questions with concrete lettered options, the recommended default marked, **and the assumption behind that recommendation in one sentence** — so a one-word reply (or a single "давай по препоръките" equivalent in `client_language`) is a full answer.
- **Assumptions instead of questions:** when the ambiguity has one clearly best reading (from BRD + code + the other tickets), don't block the ticket — state it as an assumption ("we'll do X unless you object", in `client_language`) in the same comment's assumptions list.
- A ticket with no questions and no assumptions worth stating is untouched and reported as "ready for the round".

## 4. Post

- On each ticket with content, post ONE comment starting with the `question_marker` + ` — DD.MM.YYYY`: first the numbered questions (if any), then an assumptions list (if any) — all in `client_language`. Answers are expected as replies in the same comment thread — from whoever answers; /feedback-round reads the whole thread as spec.
- Flip status → **update required** and assign `ai_assignee` **only when the comment contains at least one numbered question**. An assumptions-only comment leaves the status untouched — the ticket stays in the round and runs on the stated defaults.
- A synced ticket's `feedback_table` row stays `open`. A direct ticket has no row — nothing to touch in the DB.
- **Idempotent re-runs:** before posting, scan existing comments for previous `question_marker` comments; never repeat an already-asked question or an already-stated assumption. Nothing new → don't touch the ticket at all.

## 5. Summary (chat only)

- Report a table, one row per ticket: link · type (synced/direct) · progress state (not started / partial / appears done) · size estimate (S/M/L from the code investigation) · outcome (ready / ready on stated assumptions / questions posted / confirm-close asked) · the questions asked.
- Below the table: unanswered **update required** tickets with how long they've been waiting, and stuck **in progress** tickets with their real code state. Close with a suggested round scope — which ready tickets make a coherent next round.
- Remind the handoff: once questions are answered in the comments, `/feedback-round` picks those tickets up automatically via its **update required** sweep; unanswered tickets stay out of the round. Direct tickets flow into the round exactly like synced ones.
