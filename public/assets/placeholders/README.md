# Placeholder Assets

This folder contains placeholder assets for the Gryph Club Connect UI prototype.

## Files

| File | Description |
|------|-------------|
| `logo-gryph-placeholder.svg` | Placeholder for the Gryph (griffin) logo |
| `avatar-placeholder.png` | Generic avatar placeholder used for user profiles |
| `hero-placeholder.jpg` | Placeholder for the hero/banner image on the landing page |
| `placeholder-rect.svg` | Generic rectangular placeholder (reusable in any component) |

## How to Replace

When the real Figma Make exported assets are ready:

1. Export the assets from [Figma Make – Gryph Club Connect UI Prototype](https://figma.com/make/XI3ANaPhNK1qYGOxZp0IWR/Gryph-Club-Connect-UI-Prototype).
2. Rename each exported file to match the filename listed above (or update the import paths in the components).
3. Drop the files into this folder, overwriting the placeholders.
4. Commit with a message such as `feat(assets): replace placeholder images with Figma exports`.

## Notes

- SVG files can be imported directly as React components or referenced via `<img src>`.
- PNG/JPEG files should be optimized before committing (use `imagemin` or Squoosh).
- Inter font is imported from Google Fonts in `fonts.css` – **do not change that import**.
