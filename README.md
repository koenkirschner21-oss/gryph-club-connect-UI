# Gryph Club Connect UI

A platform for discovering, joining, and managing university clubs at the University of Guelph.

## Tech Stack

- **Vite** – Build tool
- **React 19** – UI framework
- **TypeScript** – Type safety
- **Tailwind CSS v4** – Utility-first styling
- **React Router v6** – Client-side routing
- **Google Fonts (Inter)** – Typography

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Scripts

| Command           | Description                |
| ----------------- | -------------------------- |
| `npm run dev`     | Start development server   |
| `npm run build`   | Type-check and build       |
| `npm run lint`    | Run ESLint                 |
| `npm run preview` | Preview production build   |

## Project Structure

```
src/
├── components/
│   ├── layout/       # AppShell, Navbar, Footer
│   └── ui/           # Button, Card, SearchBar, ClubCard
├── data/             # Mock data
├── pages/            # HomePage, ExplorePage, ClubProfilePage
├── types/            # TypeScript interfaces
├── App.tsx           # Router setup
├── main.tsx          # Entry point
└── index.css         # Tailwind + brand tokens
```

## Routes

| Path              | Page             |
| ----------------- | ---------------- |
| `/`               | Homepage         |
| `/explore`        | Explore clubs    |
| `/explore/:clubId`| Club profile     |

## Placeholder Assets

Placeholder assets for the Figma Make UI prototype have been added under
[`public/assets/placeholders/`](public/assets/placeholders/).

These files are temporary stand-ins and **will be replaced** once the real
exported assets are provided from the Figma Make project:
[Gryph Club Connect UI Prototype](https://figma.com/make/XI3ANaPhNK1qYGOxZp0IWR/Gryph-Club-Connect-UI-Prototype).

See [`public/assets/placeholders/README.md`](public/assets/placeholders/README.md)
for the full list of placeholder files and replacement instructions.

> **Note:** The Inter font is imported from Google Fonts in `index.html` and
> should remain unchanged per project guidelines.
