# Visual Letter-Pair Inspection and Adjustment

These are the user's geometric observation methods and trial preferences, not a standardized A–Z kerning table. Results depend on glyph shape, case, size, weight, font version, and existing kerning.

## How to inspect

Examine negative space between adjacent glyphs and the rhythm of the whole word, rather than comparing only the horizontal distance between outer edges. These groups contain representative shapes; they are not mutually exclusive categories covering all 26 letters:

- Straight-sided: I, H, M, N.
- Curved: O, C, Q, G.
- Diagonal or open: A, V, W, Y, T, L.

After inspecting enlarged outlines, return to the final print size and assess the whole word. Geometric perfection under magnification does not guarantee even spacing at reading size. Confirm the font and size before making local adjustments.

## Pairs to inspect for tighter spacing

| Pair | What to inspect |
|---|---|
| AV / VA / AW / AY | Diagonals may create excessive empty space; try tightening if needed. |
| Ta / Te / To / Ti | The following letter may fit beneath the T crossbar; check whether inward adjustment helps. |
| Ly / Li / Lo | The open upper-right area of L can make the following letter appear too distant. |
| Wo / Wa / We | The W diagonal and the following contour may benefit from tighter spacing. |

The user's **-40 to -80** values are candidate trials for problematic combinations such as AV/VA/AW/AY at display sizes, in 1/1000 em. **They are neither required targets nor fixed amounts to subtract from existing values.** Inspect the current Optical/Metrics result first, then adjust in small steps. Leave already-even spacing alone, especially at body sizes. Verify how manual values interact with automatic kerning using the application's actual readings, mode, and rendering; do not blindly add adjustments.

After tightening, check for contact between strokes, serifs, and diacritics, and for letters that could be mistaken for ligatures or other glyphs. Natural visual breathing room matters more than reaching a number.

## Geometric comparisons for sans-serif text

Compare HH/II, HO/IC, and OO/CG in the same font and size:

- Straight–straight pairs often create enclosed rectangular negative space and may need a larger physical gap.
- Straight–curved pairs have more open space above and below and may allow a slightly tighter physical gap.
- Curved–curved pairs may allow closer spacing to compensate for open space above and below.

These are starting observations, not instructions that two round letters must always be closest or nearly touching. Do not create collisions to equalize negative space. Do not assume pairs with different side shapes, such as HH and II, have equal widths.

## Inspection priorities for serif text

Start with Optical kerning under this skill's default, then consider these house-style preferences:

- T/V/W followed by lowercase letters, such as Ta, Vo, and We: moderate tightening may help, while preserving breathing room between serifs.
- OO/CC/OQ: inspect the visual weight of the sides of round letters. Loosen an excessively tight trial where useful; do not assume every serif font needs wider spacing.
- HH/IL/NN: prioritize natural, stable spacing. Built-in Metrics kerning may serve as a comparison. Leave a natural Optical result unchanged; this example does not authorize silently switching all serif text to Metrics.

Serif construction and stroke stress vary by font. Do not assume every round letter is thickest at its left and right sides.

## When to stop

Local kerning cannot replace paragraph-level line breaking, hyphenation, or word-spacing control. If tightening saves one line but loosens neighboring lines, creates collisions, or causes widows or orphans, undo the trial and return to paragraph composition. Locked specifications, content integrity, and widow/orphan control take priority over the short-word line-ending preference.

## Software references

These sources explain software mechanisms; they do not endorse this skill's house style or trial values:

- [Adobe: Kerning and tracking](https://helpx.adobe.com/uk/indesign/desktop/format-and-style-text/tabs-indents-and-spacing/about-kerning-and-tracking.html)
- [Adobe: Tracking scope and units](https://helpx.adobe.com/indesign/desktop/format-and-style-text/tabs-indents-and-spacing/adjust-tracking.html)
- [Adobe: Metrics, Optical, and manual kerning](https://helpx.adobe.com/ph_fil/indesign/desktop/format-and-style-text/tabs-indents-and-spacing/adjust-kerning.html)
