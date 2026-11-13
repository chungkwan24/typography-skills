# InDesign MCP connection through native UXP

Read this when an agent needs named MCP tools rather than repeated debugger submissions. The implementation is in `scripts/indesign-mcp/`. Typography decisions and editing authority remain in SKILL.md and the current request; connecting or installing does not authorize manuscript changes.

## Connection model

MCP client → official Python MCP SDK over stdio → authenticated JSON mailbox in the UXP plugin's private data folder → native InDesign UXP DOM.

The plugin polls approximately once per second. There is no HTTP listener, network permission, ExtendScript relay, arbitrary-code tool, or full-filesystem UXP permission. An earlier loopback HTTP experiment was rejected by the tested host's manifest checks; the private-mailbox transport was the working implementation. The mailbox token is local pairing, not protection against another process that can read the same user's files.

### Included files

- `server.py`: nine MCP tools, one unresolved request at a time, session/receipt checks, and a POSIX process lock.
- `plugin/manifest.json`, `index.html`, `bridge.js`: UXP loader, authenticated polling and read-only document inspection.
- `plugin/editor.js`: bounded tracking plans, write-ahead records, conditional restoration, and explicit existing-file save.
- `setup.py`: generate local credentials, optionally pair the mailbox, and generate a local stdio configuration fragment. It does not install packages, register MCP, load plugins, or operate on documents.
- `requirements.txt`: tested SDK pin (`mcp==1.30.0`).
- `tests/`: bridge, setup and mock native-editor tests. No manuscript or live-edit test is included.

## Prefer an existing working connection

If `indesign_local` tools are already available, start with `get_connection_status`, then `list_documents`. Do not launch another server or load a second pairing. Match the actual target ID and name before inspection. Page arguments use physical page order: cover=1, regardless of printed folios.

The packaged copy is for reuse. Adding it to this skill does not move an existing server registration or replace a loaded plugin. This machine's original project-based MCP can continue running independently of this archive; do not run the two copies against the same plugin mailbox simultaneously.

## Establish a new local pairing

Tested server platform: macOS/POSIX, Python 3.10+. The plugin was qualified on InDesign 2026 21.2.0.30. Windows is not validated; the current server imports `fcntl` and therefore needs adaptation before Windows use. The manifest minimum is not a claim of validation on every supported host version.

In the `scripts/indesign-mcp/` directory:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
python3 setup.py
```

In Adobe UXP Developer Tools, add `plugin/manifest.json` and Load it into the intended InDesign instance. The plugin ID is `latin-book-local-mcp-v2`. If migrating from an older copy with that ID, first unload the old copy and update the UDT source path; do not leave two source registrations/pairings competing.

Discover the actual private mailbox path in that loaded plugin's Debug console, once:

```js
require('uxp').storage.localFileSystem.getDataFolder()
  .then(folder => console.log(folder.nativePath));
```

Use the returned absolute path, not a guessed path from another host version or machine:

```sh
python3 setup.py --mailbox '/absolute/private/plugin/data/directory'
```

The initial token is reused on subsequent setup runs. The plugin must have loaded the generated `plugin/config.js`; if configuration changed after Load, reload the plugin. Do not expose the token in chat, logs or source control. `runtime/`, `plugin/config.js`, `.venv/` and caches are excluded by the included `.gitignore`; these are not shipped with the skill.

`setup.py` generates `codex-config.toml` with absolute paths to this package's `.venv/bin/python` and `server.py`. `--python /absolute/python` can select an existing interpreter with the requirements installed. Review the generated fragment and merge only the intended server entry into the MCP client's configuration under the current task's authorization. If `indesign_local` already exists, deliberately choose which package to use rather than appending a duplicate table. Do not overwrite unrelated configuration.

For Codex, configuration uses `[mcp_servers.indesign_local]`, `command`, `args`, `startup_timeout_sec=20`, and `tool_timeout_sec=45`. See [official MCP configuration](https://developers.openai.com/codex/mcp/). A client refresh or new chat may be needed for its tool catalog to update; a generated fragment alone is not an active connection.

The MCP client starts the server over stdio. Do not start it as an unrelated background process. The agent's host environment needs read/write permission to the paired private mailbox and this package's runtime directory. Confirm the plugin is loaded again after InDesign restarts. Once loaded, ordinary MCP calls do not require debugger code injection.

## Tools and operation boundaries

| Tool | Purpose |
| --- | --- |
| `get_connection_status` | Recent heartbeat, host version and pending request status. No host job. |
| `list_documents` | IDs, names, page counts, modified states. |
| `inspect_document(document_id, expected_name)` | Font statuses, physical order/side, numbering sections, overset story IDs. |
| `list_text_frames(document_id, expected_name, physical_page)` | Frame/story IDs, start indexes, lengths and previews up to 80 characters on one physical page. |
| `prepare_tracking_edit(document_id, expected_name, story_id, start, length, expected_text, tracking)` | Preview exact-text guarded tracking change; no document mutation. Plan expires after five minutes. |
| `apply_prepared_edit(plan_id)` | Apply one prepared plan after rechecking text and tracking; return a transaction ID. No implicit save. |
| `restore_edit(document_id, expected_name, transaction_id)` | Restore recorded tracking only if the current story text and target tracking still match. No implicit save. |
| `get_edit_record(transaction_id)` | Read a record from the current plugin session. |
| `save_document(document_id, expected_name, expected_modified)` | Explicitly save all current changes into the already-saved document's existing file. |

`start` is a zero-based native story character index. Each edit is limited to 1–128 characters; stories over 250000 characters are refused by this prototype. Tracking is in 1/1000 em. The accepted numeric range is an implementation bound, not a typography recommendation. Inspection caps are 2000 pages and 5000 stories. Font status is not a complete missing-font preflight.

Prepare → review → apply → inspect actual composition → save only as authorized. Use the apply result's transaction ID for restoration, not the prepare plan ID. No tool changes wording, fonts, font size, leading, paragraph styles or frame geometry. There is no Save As, PDF, IDML export, close or global Undo tool. Save writes all current document changes, including pre-existing manual changes; authorization must cover the actual target file and those changes.

## Failure and recovery

The server permits one unresolved job, and its process lock prevents concurrent servers for the same package. A delivered request that times out after 30 seconds becomes `unknown`; do not retry automatically. An undelivered request can be cancelled. The plugin rejects other-session requests, and retains the latest completion receipt for delivery retry without re-executing that job. A session change invalidates old pending work.

`mailboxReady` in plugin diagnostics means it could write the mailbox, not that a client is connected. Use the MCP status tool for connection checks. If the app stops responding, stop queued mutations; this bridge does not automatically force quit, discard work or alter recovery data.

Before tracking mutation, `transaction-<id>.json` records the exact target range and original/new tracking. Complete story text stays in memory for staleness checking and is not returned by the tool or written to this journal. `mutation-state.json` with `applying`, `restoring` or `unknown` blocks future edits and saves, including after reload. Inspect the journal and actual document; do not delete the state file to bypass uncertainty. Automated unknown-state reconciliation is not implemented.

Restoration is conditional and limited to the current plugin session. It does not undo arbitrary edits or overwrite later manual changes. Plugin reload loses in-memory plans and restoration handles; the durable journal remains evidence, not an automatic replay mechanism.

Native Undo remains **unqualified in this calling flow**. Earlier direct debugger and UXPSCRIPT/ENTIRE_SCRIPT trials did not succeed, but complete error/undo-stack diagnostics were not retained; this does not establish that InDesign Undo is generally broken. Future qualification should record active document, undoName/undoHistory, synchronous named transaction boundaries, and separate undo/redo calls with actual value checks. Do not label explicit restoration as native Undo.

## Verification and evidence

Run from this package directory, with dependencies installed:

```sh
.venv/bin/python -m unittest discover -s tests -v
node tests/editor.test.cjs
```

The original implementation passed a real SDK-client read on macOS/InDesign 21.2.0.30: 41 physical pages, 3 sections and 6 font faces. Its separate `MCP_Validation.indd` test passed prepare/apply/save/restore/save and rejection checks. These are historical host results, not a claim that the copied package has been freshly paired or live-tested on another path/installation. Packaging checks validate unchanged host code, setup behavior and mocks; they do not validate full-book typography, long-term stability or native Undo. Test documents, private paths, tokens, runtime state, virtual environments and machine-specific reports are intentionally omitted.

Official references: [Adobe UXP plugins](https://developer.adobe.com/indesign/uxp/plugins/getting-started/), [Application DOM](https://developer.adobe.com/indesign/uxp/dom/api/a/application/), [Document DOM](https://developer.adobe.com/indesign/uxp/dom/api/d/document/).
