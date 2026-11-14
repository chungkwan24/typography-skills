# Backend: PDF or screenshots only

Use this when the user provides only a PDF or page images. Review mode is the only real option, because there is no editable source.

## What can be checked

- Visible layout: widows, orphans, runts, rivers, heading spacing, last-word preferences, uneven colour, collisions, missing glyphs.
- Page sides and page labels (for recto starts and contents-page references), as far as the PDF's page labels and imposition show them.
- For print PDFs, the technical checks in [../print-pdf.md](../print-pdf.md).

## What cannot be claimed

Do not claim to have verified complete stories, styles, hidden characters, threading, native section setup or editability, and do not claim to have repaired the source. Say which findings need the editable source to confirm or fix, and ask for it (INDD/IDML, .docx) when the user wants changes.

## Method

Render pages to images for visual checks, extract text per page for line-ending checks, and report each issue with the page label, physical page and the surrounding text.
