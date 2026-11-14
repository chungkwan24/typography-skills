# Running InDesign scripts on macOS

Use native ExtendScript to inspect or edit INDD objects. Use application UI automation to select the intended document, run the script when necessary, and inspect the composed result. This workflow needs neither Windows COM nor a third-party InDesign control plugin. Discussing or installing the skill does not authorize manuscript edits.

## Prepare an immutable job

Identify the installed, running InDesign version and the target document's full path. Work with the current in-memory document, including the user's unsaved edits. Do not close and reopen it merely to refresh state.

Write an operation-specific JSX payload in the project's `work/` directory. Its final expression must evaluate to a function:

```javascript
(function(doc, job, helpers) {
    // Perform only the currently authorized operation.
    // Numeric script measurements are already POINTS.
    return {checked:true};
})
```

Start with the supplied read-only probe:

```bash
python3 <skill>/scripts/prepare_indesign_job.py \
  --payload <skill>/scripts/inspect_document.jsx \
  --document '/absolute/path/Book.indd' \
  --job-root '/absolute/project/work/indesign-jobs'
```

The preparer writes workspace files only. It does not launch InDesign, install a panel entry, save the document, or export anything. It snapshots the payload into a unique job directory and returns `runScript`, `panelLauncher`, `statusFile`, and `resultFile`. Do not replace an in-flight job's files. JSX paths are ASCII-escaped so Unicode paths remain intact.

## Execute using an available native route

**AppleScript:** When permitted by the environment, write the following to an AppleScript file, substituting the actual application version and absolute `runScript` path, then execute it with `osascript`:

```applescript
with timeout of 120 seconds
    tell application "Adobe InDesign 2026"
        do script (POSIX file "/absolute/project/work/indesign-jobs/job-id/run.jsx") language javascript
    end tell
end timeout
```

A timeout does not mean InDesign stopped executing. Inspect the job and application before any retry. If cross-application execution is restricted, use the Scripts panel rather than repeatedly retrying Apple events.

**Scripts panel:** This fallback has worked in a live project when Apple events were restricted.

1. Open Window → Utilities → Scripts. Right-click User → Reveal in Finder to locate the actual Scripts Panel directory; do not assume its version or locale.
2. Copy the generated `Run_InDesign_Job.jsx` launcher there. Confirm the previous job has ended before replacing an existing launcher. Filesystem installation permissions are separate from document-editing authorization.
3. Connect to the intended InDesign application, get fresh UI state, and double-click the launcher once. Use the menu if a shortcut is unavailable; never rely on old accessibility indices.
4. Read that job's status and result. A successful UI click alone is not task completion.

Do not use one fixed launcher that points at a shared, mutable payload file (an earlier project did): unique job directories replace that pattern, and its absolute paths must never be copied into new projects.

## Status, guards, and recovery

The wrapper finds the open document whose saved full path matches the job (it need not be the active window), temporarily selects point units and suppresses modal dialogs (`NEVER_INTERACT`), executes the payload with that document as `doc`, writes JSON results, and restores both preferences. It does not activate another document, save, close, or export automatically. Because dialogs are suppressed, payloads must report problems in their returned result rather than through `alert()`; use the passed `doc`, not `app.activeDocument`.

- `RUNNING`: execution entered the wrapper; this alone does not prove healthy progress. Do not launch concurrent jobs, replace the payload, or repeatedly double-click.
- `COMPLETE`: the function and result writing finished. Validate the returned evidence and actual page composition against the task requirements.
- `ERROR`: read the error and line number. A mutating payload may have partially changed the document; there is no automatic transaction rollback. Inspect current state before preparing a corrected job.
- No status file: inspect the launcher path and UI for a blocked modal dialog or a job that never started. Do not assume a crash.

If a status file already exists, the wrapper returns without rerunning. This prevents accidental repeated execution, but is not a multi-process lock. Dispatch only one job at a time. Do not delete a status file to repeat a mutation; inspect the document and prepare a new job instead.

When an application appears stuck, distinguish script execution, modal dialogs, and application failure. Preserve saved files and recovery data. Do not automatically force-quit or delete recovery caches. A historical full-book IDML export hung in INXCore/SaveBack; that is evidence about that document and operation, not a claim that every IDML export fails. Do not blindly retry a known failing export.

## Saving, exports, and verification

- The wrapper and supplied probe never save or export. An editing payload may call `doc.save()` only when saving is authorized, after its own checks pass.
- Follow the user's same-file or versioning preference. Do not create unsolicited numbered versions or discard an open modified document.
- Do not generate PDF or IDML unless explicitly requested. Use application screenshots for visual checks; when needed, export a limited range of temporary PNGs under project `work/` and restore any export preferences changed. Such checks are not physical print proofs.
- Compare content and inspect overset text, actual line breaks, and project specifications. Physical order is `documentOffset + 1`, the document page label is `page.name`, and left/right placement is `page.side`; do not substitute one for another. A manually typed folio may differ from the native page label.
- `LINK_EMBEDDED` means embedded, not missing. A report with no story overset does not establish the absence of runts, widows/orphans, wrong contents-page references, low-resolution images, or cell overset.
- JSON must escape every control character, including table marker U+0016. The supplied serializer does this.
- The probe returns each frame's story ID, previous/next threaded frame, text length and an 80-character preview, not full contents. Use it to check threading and frame counts; extract full text only for a targeted range when the task needs it.
- When the job was launched through UI automation, report completion from the observed status/result files and current UI, not from the click.

The provided scripts have been syntax-checked and tested using a simulated ExtendScript host for immutable payloads, unique jobs, document-path rejection, duplicate prevention, JSON control-character handling, and preference restoration. The path-based document lookup, dialog suppression and preview-limited probe were added afterwards and still need a live host run. Native application checks are still required in the actual project; the simulation does not prove page composition.
