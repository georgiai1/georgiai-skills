---
name: fix-stale-mcp-oauth
description: Use when an MCP server's OAuth login in Claude Code fails on every attempt with "Unrecognized client_id" or invalid_client — /mcp → Authenticate loops endlessly, one project fails while the same server works in other projects, and reinstalling/re-adding the server under the same name changes nothing. Applies to any OAuth MCP server (Supabase, Notion, etc.) whose Dynamic Client Registration went stale.
---

# Fix Stale MCP OAuth Registration

## Overview

Claude Code caches each MCP server's OAuth Dynamic Client Registration (DCR) in
`~/.claude/.credentials.json` under `mcpOAuth`, keyed as
`<server-name>|<hash-of-exact-server-URL>`. If the auth server drops that
registration, every login re-sends the dead `client_id` and fails with
"Unrecognized client_id". The `/mcp` UI has no way to clear it, and re-adding
the server under the same name resolves to the same cache key.

**Fix:** delete that one cache entry, fully restart Claude Code, authenticate
again — a fresh DCR is performed and login succeeds.

## When NOT to use

- First-ever login fails → normal auth flow problem, not a stale cache.
- "Unauthorized" after weeks of working → expired grant; plain re-authenticate.
- A **freshly registered** client_id also fails → server-side fault; use the
  token route (see Escape hatches).

## Procedure

**Never `cat`/Read `.credentials.json` — it holds live tokens for every server.
Inspect and edit only via scripts that print metadata.**

1. **Get the exact server URL** from the project's `.mcp.json` (or
   `claude mcp list`). The cache key hashes the *full* URL — same
   `project_ref` with different query params (`features=…`) is a *different*
   entry. Match exactly.

2. **List cache entries (metadata only):**

```bash
node -e "const j=require(process.env.HOME+'/.claude/.credentials.json');for(const[k,v]of Object.entries(j.mcpOAuth||{}))console.log(JSON.stringify({key:k,serverUrl:v.serverUrl,clientId:(v.clientId||'').slice(0,8)+'…',hasAccessToken:!!v.accessToken}))"
```

   The stale entry: server name + exact URL match, usually `hasAccessToken:false`.

3. **Delete only that key, with backup:**

```bash
node -e "
const fs=require('fs'),p=process.env.HOME+'/.claude/.credentials.json';
const KEY='<paste key here>';                       // e.g. 'supabase|1d13536c33d86b15'
fs.copyFileSync(p,p+'.bak');
const j=JSON.parse(fs.readFileSync(p,'utf8'));
if(!j.mcpOAuth?.[KEY]){console.error('key not found');process.exit(1)}
delete j.mcpOAuth[KEY];
fs.writeFileSync(p+'.tmp',JSON.stringify(j,null,2));
JSON.parse(fs.readFileSync(p+'.tmp','utf8'));       // sanity-parse before replacing
fs.renameSync(p+'.tmp',p);
console.log('removed',KEY);
"
```

4. **Fully exit Claude Code — every window/instance.** A running instance holds
   the old registration in memory and writes it back on any token refresh.
   This is the step people skip; without it the fix silently reverts.

5. Restart, `/mcp` → server → **Authenticate**. Fresh DCR + browser consent.
   Verify: the authorize URL's `client_id` no longer matches the deleted one.

6. Works? Delete the `.bak`.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Matching by `project_ref` alone | Deletes a sibling entry; the active one (different query params) stays stale |
| Leaving Claude Code running after the edit | Any token refresh writes the stale entry back — exit all instances immediately after the delete |
| Reading the credentials file into context | Leaks live tokens for every connected server |
| Deleting all `mcpOAuth` entries "to be safe" | Forces re-auth of every server on every machine profile |
| Reinstalling the server under the same name | Same URL → same key → same dead registration |

## Escape hatches

- **Different server name** in `.mcp.json` → new cache key → fresh DCR. Works,
  but leaves the dead entry behind; deleting is cleaner.
- **Fresh client_id still fails** → server-side fault. Bypass DCR with a
  personal access token from an env var (token type per that server's docs,
  e.g. Supabase `sbp_…`):
  `"headers": { "Authorization": "Bearer ${SERVER_ACCESS_TOKEN}" }`
  (never paste the token into the file).
