# georgiai plugin — feedback workflow setup

Customer feedback rounds end-to-end, driven from ClickUp. Two commands:

| Command | What it does | Side effects |
|---|---|---|
| `/feedback-prep` | Reads feedback tickets + BRD + code, posts clarifying questions as ClickUp comments | Comments + status flips only; no code |
| `/feedback-round <N>` | Consolidates tickets, implements via parallel subagents in dependency waves, ships per package | Code, commits, deploy, ClickUp/DB/BRD sync |

The intended loop: `/feedback-prep` → owner answers in ClickUp comment threads → `/feedback-round N` picks up answered tickets automatically.

## Prerequisites

- ClickUp MCP connector (the commands fall back to the ClickUp REST API when rate-limited)
- A DB table that records filed feedback and links each row to its ClickUp task
- Database access from Claude Code (e.g. the Supabase MCP) if you want DB sync

## Per-project setup (required)

Add a `## Feedback workflow` section to the project's `CLAUDE.md` (or create `.claude/feedback-workflow.md`):

```markdown
## Feedback workflow
- clickup_list: 901524746867 ("🏬📦 My Project")
- feedback_table: bug_reports
- ticket_id_column: clickup_task_id
- client_language: Bulgarian
- ai_assignee: "Georgi AI" (266686581)
- verify_commands: npx vitest run <scope> / npm run typecheck / npm run lint
- brd_location: Company Wiki doc 2kyqtm8b-2995 → BRDs → "My Project - BRD"   # optional
- statuses: to do / update required / in progress / complete                 # optional
- question_marker: "❓ Въпроси преди кръга"                                  # optional
- ticket_naming: "<reporter name>: <title>"                                  # optional
- clickup_token_source: integration_secrets.clickup_token                    # optional
- deploy: push main → auto-deploy                                            # optional
- docs: docs/status.md + docs/tasks.md                                       # optional
```

Both commands hard-stop with this template if the section is missing — they never guess list IDs, table names, or deploy behavior.
