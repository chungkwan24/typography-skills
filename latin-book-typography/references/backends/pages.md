# Backend: Apple Pages

**Status: framework only.** Nothing here has been verified against the user's Pages version; items marked *verify* are unconfirmed.

Typography rules and modes come from SKILL.md.

## Approach

`.pages` is a proprietary package format and is not safe to edit directly. Use one of these instead:

- **Review:** ask the user to export a PDF from Pages and review it under [pdf-only.md](pdf-only.md), with the limits stated there.
- **Edit, if the user accepts a format change:** export to .docx and follow [docx.md](docx.md). Say clearly that the result is a Word document and that layout may differ from the Pages original.
- **Edit, staying in Pages:** give the user a precise manual checklist (style, setting, page and value for each change) and review the PDF they export afterwards.

## Expected capabilities (verify)

- Justified alignment, Keep lines together, Keep with next paragraph and widow/orphan prevention in paragraph settings.
- Character spacing as a percentage; no optical kerning.
- Hyphenation on or off, without fine limits.
- Sections and page-number formats are available but weaker than InDesign's.

## Cannot enforce or verify

Optical kerning, precise tracking, hyphenation limits, and anything inside the .pages file that the exported PDF does not show. State these in the report.
