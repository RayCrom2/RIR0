# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server (http://localhost:5173/)
npm run build    # production build
npm run preview  # preview production build
```

There is no test suite configured.

## Architecture

This is a React 18 + Vite SPA. Routing is handled by `react-router-dom` (v7). Bootstrap 5 is installed but not heavily used; most styling is inline or in `src/styles.css`.

**Entry:** `index.html` → `src/main.jsx` wraps the app in `<BrowserRouter>` → `src/App.jsx` defines the nav and top-level `<Routes>`.

**Routes defined in `App.jsx`:**
| Path | Component |
|---|---|
| `/` | Inline welcome stub |
| `/diagram` | `DiagramPage` |
| `/videos` | `Videos` |
| `/nutrition` | Inline stub |
| `/workouts` | Inline stub |

**Data layer (`src/data/`):**
- `muscles.js` — keyed dictionary of muscle groups. Each entry has `slug`, `name`, `description`, `tips`, `exercises[]`, `contraindications[]`, and optionally `parts[]` for sub-regions. Keys are base slugs (e.g., `deltoids`, `chest`). The `.left` / `.right` suffix convention is stripped at lookup time.
- `videos.js` — flat map of exercise name → YouTube URL. The `Videos` page builds its exercise list dynamically by aggregating all `exercises` arrays from `muscles.js`, so new exercises appear automatically when added to `muscles.js`, but they need a corresponding entry in `videos.js` to have a video.

**Diagram components (`src/components/`):**
Four SVG body diagrams, each a standalone component that accepts `selected` (active slug), `onSelect` callback, and for the front view, `selectedSubpart`:
- `HumanDiagram.jsx` — male front
- `HumanDiagramBack.jsx` — male back
- `HumanDiagramFemaleFront.jsx` — female front
- `HumanDiagramFemaleBack.jsx` — female back

Each diagram defines SVG path data inline. Muscle regions are rendered as `<g class="muscle">` elements with a `data-muscle` attribute set to the slug. The `DiagramPage` listens for clicks via a capture-phase listener and also for a custom `muscle-select` DOM event, normalizing the value through `extractSlug()`.

**DiagramPage (`src/pages/DiagramPage.jsx`):**
- Manages `selected` (active muscle slug), `activePart` (active sub-part key), and `diagramView` (`'front'` | `'back'` | `'front2'` | `'back2'`).
- Info panel renders muscle data from `muscles.js`. Clicking an exercise link navigates to `/videos?exercise=<name>`.

**Videos page (`src/pages/Videos.jsx`):**
- Reads `?exercise=` query param and smooth-scrolls to that card on mount.
- Exercise list is derived from `muscles.js`, not hardcoded. Matching against `videos.js` is done case-insensitively using slugified keys.
- YouTube thumbnails are shown by default; clicking loads the iframe embed with autoplay.

## Styling conventions

- Accent color: `#ff8c42` (CSS var `--accent`)
- Background: `#f7f7fb` (CSS var `--bg`)
- Most component-level styles are written as inline `style` objects directly on JSX elements. Global/structural styles live in `src/styles.css`.
- `.muscle.selected` triggers the orange highlight via CSS (see `styles.css`).
