# Print-ready PDF checks

**Status: draft checklist.** The printer's own specification always wins; ask for it when the user has one. These checks run only when the deliverable is a printed book, and exports happen only when the user asks for them.

## Before export (ask or confirm)

- Printer or service and its PDF specification (often a PDF/X standard such as PDF/X-1a or PDF/X-4).
- Trim size, bleed (commonly 3 mm / 0.125 in where the printer gives none), and whether crop or bleed marks are wanted.
- Colour: CMYK or grey for the interior, or a colour-managed RGB workflow if the printer accepts it.
- Cover handled separately from the interior unless the printer says otherwise.

## Check in the exported PDF

- **Fonts:** every font embedded (or subset-embedded); none missing or substituted.
- **Page boxes:** TrimBox matches the trim size; BleedBox includes the bleed; objects meant to bleed actually extend into it.
- **Images:** effective resolution about 300 ppi for photographs and higher for line art at final size; flag anything well below.
- **Colour:** no unintended RGB or spot colours; black body text is a single black, not rich black.
- **Standard:** the PDF/X identifier matches the requested standard.
- **Pages:** page count, order and left/right sides match the agreed facing-page convention; blank pages are present where intended.

Report each failed item with the page and object. A passing checklist is not a physical proof: recommend a printed proof for colour and binding decisions.
