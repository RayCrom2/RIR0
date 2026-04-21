# RIR0
An All-In-One Fitness application that is going to prioritize a feature that provides muscle specific stretching, exercises, information, and injury self-assessment.


## UI prototype (React)

This repository now contains a small React + Vite prototype for an interactive muscle-selection UI.

Files added:
- `index.html` — Vite entry
- `package.json` — project manifest and dev scripts
- `src/main.jsx` — React entry
- `src/App.jsx` — main app shell
- `src/components/HumanDiagram.jsx` — interactive SVG muscle diagram
- `src/styles.css` — basic styles

Run (PowerShell):

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173/) to see the diagram. Click or tab+Enter on muscle regions to select them. The legend on the right also toggles selection.

