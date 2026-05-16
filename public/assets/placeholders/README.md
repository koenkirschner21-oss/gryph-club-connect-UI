# Placeholder Assets

This folder contains generic placeholder assets for the Gryph Club Connect UI prototype.

## Official branding

The **production logo** (gryphon + ClubConnect wordmark) lives next to this folder:

- `public/assets/gryph-club-connect-logo.png` — used in the navbar, marketing heroes, and favicon.

## Files in this folder

| File | Description |
|------|-------------|
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
