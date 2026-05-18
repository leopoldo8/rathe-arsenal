# Slot icons

Placeholder SVGs for the four deck slot types used by `SlotPicker`.

## Source and license

Shapes adapted from [Lucide](https://lucide.dev) (MIT License). Each icon
is a single-color glyph styled via `currentColor` so it inherits the parent
element's color in all contexts (normal, hover, active, focus, dark/light
theme).

## Files

| File | Slot | Visual idea |
|------|------|-------------|
| `slot-mainboard.svg` | Mainboard | Layered card / grid |
| `slot-equipment.svg` | Equipment | Shield / armor |
| `slot-weapon.svg` | Weapon | Sword |
| `slot-hero.svg` | Hero | Person silhouette |

## Swapping icons

A visual designer can replace any `.svg` here without touching component
code. Requirements for a replacement:

1. `viewBox="0 0 24 24"` (24×24 grid, matches the 16px rendered size).
2. Strokes/fills use `currentColor` — no hard-coded hex values.
3. MIT, Apache-2.0, or equivalent permissive license.
4. Single-color glyph (no multi-color icons).
