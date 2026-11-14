# Backend: Word (.docx)

**Status: framework only.** The behaviour below is general knowledge of Word, not yet checked against the user's Word version or machine. Treat items marked *verify* as unconfirmed, and tell the user when a conclusion depends on one.

Typography rules and modes come from SKILL.md.

## What changes from InDesign

- **Composition engine:** Word composes lines and pages differently from InDesign, and pagination can change with fonts, printer drivers or another machine. A layout check is only valid for the fonts and Word version it was made with.
- **No optical kerning.** Word offers pair kerning above a chosen size. The house default (Optical for serif) cannot be applied; say so and use Metrics-style pair kerning where available.
- **Tracking** is character spacing in points (expanded/condensed), not 1/1000 em. Convert deliberately: at 10.5 pt, 1/1000 em ≈ 0.0105 pt, so Word's 0.1 pt steps are coarse.
- **Widow/orphan control** is a fixed two-line rule per paragraph, plus Keep with next and Keep lines together for headings and short paragraphs.
- **Text flow:** the body flows natively. Do not move body text into text boxes or frames.
- **Sections:** Roman front matter and Arabic body use section breaks with page-number formats and "start at" values. Recto starts use Odd Page section breaks. *Verify* that the blank pages Word adds appear in the exported PDF.
- **Hyphenation:** automatic hyphenation with a hyphenation zone and a limit on consecutive hyphens; there is no minimum-word-length or before/after-letter setting. Map the SKILL.md defaults onto what exists and report the rest as not enforceable.

## Inspecting and editing

- Read styles and text from the .docx XML (or a library that preserves it). Change styles rather than adding local formatting, and keep the file's language settings.
- Log every text change exactly as SKILL.md requires.

## Verification evidence

Use a PDF exported by Word itself on the user's machine as the evidence for page-level checks. A PDF converted by LibreOffice or another engine is reference only, never proof that the Word layout passes, because it composes differently.

## Cannot enforce or verify

Optical kerning; 1/1000-em tracking precision; InDesign-style hyphenation limits; composition on other machines. State these in the report rather than implying a pass.
