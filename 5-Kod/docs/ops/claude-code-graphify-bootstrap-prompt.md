# Claude Code prompt: bootstrap Graphify Corevo

Copy everything inside the prompt block into Claude Code from the Corevo
repository root. This prompt is intentionally self-contained for a machine that
does not have Graphify installed.

```text
Set up the existing Corevo Graphify workflow on this computer, end to end.
Execute the work; do not stop at a plan.

Safety and repository rules:
- Read AGENTS.md and HANDOFF.md first.
- Work only in the currently active branch/worktree.
- Do not modify main or any other worktree.
- Do not create files in the repository root except required config files.
- All generated Graphify data belongs only in 5-Kod/graphify-out/ or
  5-Kod/graphify-references/.
- Never commit those folders, the Open Design reference clone, credentials,
  machine-specific Python paths, logs, PIDs, or secrets.
- Treat 4-Dokument-Underlag/08-externa-verktyg/open-design/ as read-only.

Target architecture:
- One Corevo graph: 5-Kod/graphify-out/graph.json.
- One optional read-only Open Design reference graph under
  5-Kod/graphify-references/open-design/.
- One filtered watcher started by 5-Kod/scripts/graphify-live.ps1.
- One interactive page:
  http://127.0.0.1:8765/tools/graphify-live/
- One shared loopback HTTP MCP server:
  name: graphify-corevo
  URL: http://127.0.0.1:8766/mcp
- Codex and Claude may have separate client connections, but must use that same
  name, URL, and server process for both graphs. Do not create graphify-local,
  graphify-2, corevo-graph, or a second MCP server.

Install Graphify:
1. Confirm Python 3.10+ is available.
2. Prefer uv when available:
   uv tool install --upgrade "graphifyy[mcp,watch]"
   Otherwise use the active Python interpreter:
   python -m pip install --upgrade "graphifyy[mcp,watch]"
3. Verify that `graphify --version` works and that Python can import
   graphify.serve and watchdog.
4. Install Graphify's Claude Code skill/hook globally with the official
   installer. On Windows use:
   graphify install --platform windows
   Do not run a project installer that creates a root CLAUDE.md because this
   repository's root-file policy forbids it.

Build or reuse the graph:
1. Change directory to 5-Kod.
2. If graphify-out/graph.json already exists, reuse it.
3. Otherwise build a local code graph without an API key:
   graphify extract . --code-only
4. Ensure graphify-out/.graphify_python contains the exact interpreter that can
   import graphify and watchdog. If Graphify did not create it, write the
   interpreter path there.
5. Confirm 5-Kod/graphify-out/ is ignored by Git and by .claudeignore.
6. If the ignored Open Design clone exists, run:
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-open-design.ps1
7. Confirm both the clone and 5-Kod/graphify-references/ are ignored by Git.

Start the shared local services:
1. From 5-Kod run:
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-live.ps1
2. Run the same command a second time and verify it is idempotent: there must
   still be exactly one watcher, one viewer, and one MCP process.
3. Check:
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-live.ps1 -Action Status

Configure Claude Code without duplicates:
1. Inspect `claude mcp get graphify-corevo` and the project .mcp.json first.
2. If graphify-corevo already points to http://127.0.0.1:8766/mcp, reuse it.
3. If it is missing, add exactly this project-scoped server:
   claude mcp add --transport http --scope project graphify-corevo http://127.0.0.1:8766/mcp
4. If the same name exists with an obsolete stdio command or wrong URL, replace
   that entry; do not add a second name.
5. Approve the project MCP server when Claude Code requests approval.

Verify end to end:
1. Open http://127.0.0.1:8765/tools/graphify-live/ and confirm Corevo and Open
   Design can be selected, nodes are clickable, and both Call flow views open.
2. Query `list_projects`, then MCP tool `graph_stats` with `project="corevo"`
   and confirm a non-zero graph.
3. Query graphify-corevo for a real code question, then open the returned source
   files to verify the answer.
4. Touch or make a harmless reversible edit to one code file, wait for the
   five-second debounce and rebuild, and confirm graph.html changes. Revert only
   your own harmless test edit.
5. Check Git status and ensure graphify-out remains absent from it.

Required agent behavior after setup:
- Start graphify-live.ps1 at the beginning of a Corevo work session.
- Run `list_projects` first and pass an explicit project ID to every graph tool.
- For architecture, dependency, impact, and call-flow questions, query
  graphify-corevo with `project="corevo"` before broad grep/glob or reading many
  files.
- For Open Design, use the same MCP with `project="open-design"`.
- Use `query_projects` only for an explicit comparison; never rely on a default
  graph.
- Never modify Open Design from Corevo work; use it as a comparison source.
- Use narrow questions and normally cap graph context at 800-1500 tokens.
- Treat graph output as a map, not final truth: inspect affected source files and
  run focused tests before changing code.
- Let the watcher finish after an edit wave before asking the next graph question.
- Code rebuilds are local AST work and require no LLM/API key.
- Document/PDF/image changes create graphify-out/needs_update and require a
  separate semantic Graphify update.
- Never paste all of graph.json or GRAPH_REPORT.md into context.
- Run `graphify reflect --if-stale` before graph-heavy work and use recorded
  lessons when present.

Token and accuracy goal:
- Avoid rereading the whole repository.
- Preserve Claude's prompt cache by ignoring both generated graph folders and
  the Open Design clone.
- Use the graph to identify the smallest relevant source set.
- Verify against source and tests so stale or inferred edges never become facts.

At completion report only:
- installed Graphify version
- graph node/edge/community counts for every built graph
- watcher/viewer/MCP status and PIDs
- viewer URL and MCP URL
- files changed
- any remaining blocker
```
