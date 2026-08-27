---
description: Pre-round clarification pass — read feedback tickets + BRDs + code, post clarifying questions as ClickUp comments so /feedback-round runs on a full spec
argument-hint: [optional notes, e.g. "only the stock tickets"]
---

Prepare the next customer feedback round for this project by asking clarifying questions BEFORE any implementation. This command changes nothing in the product: no parent ticket, no consolidation, no code, no commits, no migrations, no BRD edits. Its only outputs are ClickUp comments with questions, status flips to **update required**, and a summary in chat.

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

- Fetch the configured ClickUp list and find all **standalone** feedback tickets in **to do** (exclude subtasks of previous round parents — check `parent`). The authoritative match is `feedback_table.ticket_id_column`: a standalone to-do task whose ID appears there is a feedback ticket, regardless of its name; use `ticket_naming` only as a secondary hint.
- Also include tickets in **update required**: if their posted questions are still unanswered, only check whether NEW questions have appeared (don't re-ask); if answered, verify the answers actually close the ambiguity — leftover or follow-up questions get asked now, so the ticket doesn't bounce again mid-round.
- For each ticket read ALL of: full markdown, **ClickUp comments** (`clickup_get_task_comments` / REST `GET /task/{id}/comment`), the `feedback_table` row, and every screenshot (incl. ones attached in comments). Comments are part of the spec — answers may already be there.
- If the ClickUp MCP connector is rate-limited, go straight to the REST API using the token from `clickup_token_source`.

## 2. Context

- Read the BRD/spec pages relevant to each ticket (from `brd_location`, if configured), **including any dated change-log sections from past rounds** — they record decisions already made; never ask something the BRD already answers.
- Investigate the codebase and live DB (read-only) enough to make each question concrete: name the actual screen/field/behavior and what the code does today, so the answer can be one word.

## 3. Generate questions

- Only for **genuine ambiguity or owner decisions**: conflicting requirements, missing business rules, multiple plausible UX interpretations, data whose meaning only the owner knows.
- Do NOT ask: anything answerable from code/DB/BRD/screenshots/comments; pure implementation choices; confirmation of the obvious. A ticket with no real questions is untouched and reported as "ready for the round".
- Format per ticket, in `client_language`: numbered questions, each with concrete lettered options and a marked recommended default, so a one-word reply is a full answer. State briefly what the app does today when relevant.

## 4. Post

- On each ticket with questions, post ONE comment starting with the `question_marker` + ` — DD.MM.YYYY`, then the numbered questions. Answers are expected as replies in the same comment thread — from whoever answers; /feedback-round reads the whole thread as spec.
- Set that ticket's status → **update required**, assign `ai_assignee`. Its `feedback_table` row stays `open`.
- **Idempotent re-runs:** before posting, scan existing comments for previous `question_marker` comments; never repeat an already-asked question. Nothing new to ask → don't touch the ticket at all.

## 5. Summary (chat only)

- Report a table: "ready for the round" tickets vs "with questions" tickets, with links and the questions asked per ticket.
- Remind the handoff: once questions are answered in the comments, `/feedback-round` picks those tickets up automatically via its **update required** sweep; unanswered tickets stay out of the round.
