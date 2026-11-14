# Native InDesign UXP connection

Read this for UXP automation instead of ExtendScript. The helpers in `scripts/uxp-bridge/` contain connection and inspection mechanics only. Editing permissions and typography rules come from SKILL.md and the current user request. Loading a helper does not authorize manuscript changes, saving, closing, font replacement, or exports.

## Development connection

1. Start InDesign and open the intended working document. Use Adobe's official UXP Developer Tool (UDT).
2. Add `scripts/uxp-bridge/manifest.json` in UDT and load **Latin Book UXP Bridge**. Keep earlier experimental plugins unloaded.
3. Open **Debug → Console**. The bridge exposes `bookUXP`. Acquire the host app at operation time with `require('indesign').app`; capturing app during initial plugin evaluation returned undefined on the tested host.
4. Run `console.log(JSON.stringify(bookUXP.inspect(), null, 2))`. Confirm the actual document name, ID, saved/modified state, page count, and fonts before any operation. Do not identify a file by name alone when multiple copies could be open; confirm its native window URL or trusted project path too.

The bundled plugin wrapper is a development loader, not a verified CCX distribution or Marketplace installation. Its menu entry logs inspection data if invoked. Normal menu launch and docked-panel display were not established in the original trial; use the UDT console route. This packaged/refactored wrapper has mock validation, not a new live host qualification.

For an already loaded development plugin, the contents of `bridge.js` can instead be evaluated in its UDT console. This requires a native InDesign UXP context; Node.js and browser JavaScript do not control InDesign.

## Verified close / reopen recipe

Close and open in **separate console submissions**, with the result observed between them. Use only the exact authorized saved working file. The helpers never save implicitly.

```js
// Submission 1: inspect and retain identity.
globalThis.bookTarget = bookUXP.inspect();
console.log(JSON.stringify(bookTarget));
```

```js
// Submission 2: only when closing is in scope.
bookUXP.closeSaved({id:bookTarget.id,name:bookTarget.name})
  .then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(String(e)));
```

Wait for the close result and inspect the host. In the tested single-document session, openDocuments became 0. Do not keep using a closed document's DOM objects.

```js
// Submission 3: substitute the exact authorized absolute path.
bookUXP.openPath('/absolute/path/Working.indd')
  .then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(String(e)));
```

```js
// Submission 4: re-acquire native objects and inspect after opening.
console.log(JSON.stringify(bookUXP.inspect({details:true}),null,2));
```

Verify the native document window is responsive and matches the path. The name, page count, sections, fonts, and pre-existing overflow should match the baseline. A successful promise or visible window alone does not establish all these checks.

The controlled opener refuses to run while another document is open. The closer requires the inspected ID/name and refuses unsaved changes. Resolve those conditions under the user's instructions; do not bypass guards or silently discard edits. Separate close/open calls are a tested operational choice, not proof of a universal UXP requirement.

## Evidence and limits

A single successful cycle on macOS, InDesign 21.2.0.30, used native `document.close(SaveOptions.NO)` followed by `app.open(absolutePathString)` in a later invocation. The test book reopened with 41 pages, 3 sections, six fonts INSTALLED, modified=false, and the same pre-existing overset story. The application stayed responsive. This is not a long-term stability guarantee or Windows validation.

Earlier file-entry close/open attempts hung the host. The file picker also sometimes kept its Open button disabled; do not retry it indefinitely. `await document.fullName` rejected even after file selection. Therefore the bridge does not promise automatic native-path discovery. The path supplied to openPath is reported as caller-supplied evidence, not a successful fullName lookup. The manifest declares `localFileSystem: "request"` (user-confirmed file pickers only), not full filesystem access, and no network permission. `openPath` itself passes a path string to `app.open` and does not use the picker.

Direct UXP tracking edits worked, and restoring recorded values worked. `app.undo()` failed both after direct debugger edits and after a separate UXPSCRIPT/ENTIRE_SCRIPT transaction. Do not promise native undo or use this helper as a general editing transaction engine. Build explicit restoration and save checkpoints for authorized future edits; the bridge itself contains no editing operations.

Avoid broad synchronous per-character/textStyleRanges or whole-installed-font scans. Such a scan left this host unresponsive. Prefer bounded native find operations or targeted ranges, report progress between batches, and recheck host responsiveness. The detailed probe checks pages/sections/story overflow, not a complete typography or print preflight.

A host error or loss of response is not completion. Stop issuing mutations and queued retries. Preserve the last known saved state, identify the pending operation, and recover the application under existing authorization or request the necessary permission. Do not automatically force quit, delete recovery data, or reset preferences.

## Font validation lesson

An INSTALLED font status in UXP did not prove every text/style reference was valid: native preflight still reported missing Italic instances. In one project, installing the official OTF files of the same family and faces, then native **Find/Replace Font → Change All → Redefine Style When Changing All**, cleared the remaining references. This is a project observation, not permission to replace fonts in other books. Preserve face/style choices and authorized emphasis; verify native Missing Fonts=0, save only when authorized, and recheck after opening. A substitute-font rendering is not valid typography QA.

## Official references

- https://developer.adobe.com/indesign/uxp/plugins/getting-started/
- https://developer.adobe.com/indesign/uxp/dom/api/a/application/
- https://developer.adobe.com/indesign/uxp/introduction/next-steps/script-and-plugin/
