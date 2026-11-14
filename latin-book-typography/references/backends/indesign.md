# Backend: InDesign (INDD and IDML)

Typography rules and modes come from SKILL.md; this file covers how to reach the document. Paths to `scripts/` are relative to the skill root.

## File types

- **INDD:** edit in InDesign itself, through one of the routes below or the native UI.
- **IDML:** inspect and, where appropriate, edit the XML (Stories, Styles, Spreads), then recompose in a layout engine and verify the composed result. XML that looks right is not proof the pages are right.
- **PDF exported from InDesign:** use it for final page inspection, not as the editing source.

## Automation routing

Choose one route for the required operation; do not load or initialize every bridge at project intake. Connection setup does not authorize document edits, saving, closing or exports.

| Situation | Route and timing |
| --- | --- |
| A working InDesign MCP connection is available (`indesign_local` tools, e.g. `mcp__indesign_local__get_connection_status` in Claude Code) | Read [InDesign MCP connection](../indesign-mcp.md). Begin with `get_connection_status`, `list_documents`, then `inspect_document`; confirm the intended document before editing. Reuse the connection instead of starting another server. |
| An authorized, localized tracking adjustment fits the MCP limits | Use `prepare_tracking_edit`, inspect the proposed target and values, then `apply_prepared_edit`. Inspect actual composition afterward. Use `restore_edit` only for a matching recorded transaction; it is not native Undo. Call `save_document` only when saving all current changes to that existing file is authorized. |
| MCP is unavailable or does not support the required operation | Read [Running InDesign scripts on macOS](../indesign-macos.md). Prepare an immutable, document-guarded JSX job with `scripts/prepare_indesign_job.py`, starting with `scripts/inspect_document.jsx` for read-only identification and baseline evidence. Run it through AppleScript when permitted, or the Scripts-panel launcher when cross-application execution is restricted. Use an operation-specific JSX payload or the native UI for authorized edits. |
| UXP development debugging, or a specifically authorized close/open operation | Read [Native InDesign UXP connection](../indesign-uxp.md). Use `scripts/uxp-bridge/` as a specialized fallback, not routine startup. Submit close and open separately, observe each result, and reacquire document objects. Never close/reopen merely to establish a connection or to discard unsaved changes. |
| The user asks to establish or repair a local MCP connection | Follow the MCP reference and use `scripts/indesign-mcp/setup.py` for configuration preparation only. Do not run setup on every typography task or automatically migrate a working registration. |
| Nothing can run on the user's machine (e.g. a browser chat) | Prepare the JSX job or payload and ask the user to run it from InDesign's Scripts panel (Window → Utilities → Scripts), then send back the `result.json` or an exported PDF. |

## Rules on every route

The route's reference has the limits and recovery details.

- The MCP editor changes tracking only — not wording, fonts, size, leading, paragraph styles, frame geometry or sections — and cannot Save As or export. A working connection does not mean every typography operation is available.
- Helpers never save, close, export or create versions implicitly. `prepare_indesign_job.py` only writes job files; the JSX runs inside InDesign. Report a job complete only after reading its actual status and result.
- Inspection shows page order, sides, sections, threading and overset; it does not prove the absence of runts, rivers, widows/orphans or wrong contents references. Verify the composed layout separately, quoting only the evidence needed rather than manuscript text.
- Dispatch one document job at a time. After a timeout or unknown outcome, inspect status files, transaction records and the document before anything else; never switch routes to repeat an unresolved mutation or clear a recovery guard to get past it. Preserve the in-memory document and the user's unsaved edits.
- ExtendScript payloads use ES3 syntax (`var`, no `let`/`const`/arrow functions). Wrapping an edit in `app.doScript(..., UndoModes.ENTIRE_SCRIPT, ...)` may make it one Undo step, but undo has not been qualified in these routes (see the UXP reference), so keep explicit before/after records instead of relying on it.

## InDesign-specific notes

- Page sides: in facing documents the physical order is `documentOffset + 1`, the label is `page.name`, the side is `page.side`. Never substitute one for another.
- Recto starts: Keep Options → **Start Paragraph: On Next Odd Page** on the chapter-opening style lets the story reflow on later edits; confirm the resulting side once, since section numbering decides which pages are odd.
- Widow/orphan control: Keep Options → Keep Lines Together (at start/end of paragraph) and Keep with Next for headings; still check the composed pages.
