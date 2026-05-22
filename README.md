# RIR0 — All-In-One Fitness App

A full-featured fitness Progressive Web App (PWA) for nutrition tracking, workout logging, weight monitoring, and muscle education. Works for both authenticated users (data synced via Supabase) and guests (data stored in localStorage).

## Features

### Nutrition Tracking
- Log food entries with calories, protein, fat, carbs, fiber, and sugar
- Personal food library: save custom foods for quick re-use
- Daily macro progress bars with configurable targets and direction (min/max/range)
- Plan mode: stage a hypothetical day's meals before committing them to the log
- Weigh-in prompt on the nutrition page, controlled by a configurable reminder frequency
- Guest support: macro targets stored locally without an account

### Weight Logging
- Log body weight from the Profile page at any time
- Weight history chart showing progression from starting weight onward
- Once-per-day limit with an overwrite warning when replacing the same day's entry
- Reminder frequency setting controls when the prompt appears on the Nutrition page (independent of manual weigh-ins)
- Starting weight (set at onboarding, immutable) and current weight (updated by weigh-ins) shown separately on Profile

### Nutrition History Calendar
- Browse past days to see what was logged
- Macro progress bars compare logged totals against the goals that were active on that day (goals snapshot)
- Calorie-only entries display as static rows (no expand button)
- Food entries with macro detail are expandable

### Exercise Logger
- Log workouts by muscle group with sets, reps, weight, and optional notes
- Per-exercise unit toggle (lbs / kg), defaulting to the user's preferred unit from profile
- Save routines and replay them in a session
- Active workout persists across page navigations via localStorage

### Muscle Diagram & Video Library
- Interactive SVG body diagrams (male/female, front/back)
- Click a muscle region to see description, tips, exercises, and contraindications
- Muscle sub-region support (e.g., anterior/lateral/posterior deltoid)
- Video library with YouTube embeds for every exercise, derived automatically from muscle data

### Profile & Goals
- Set calorie and macro targets with flexible goal types (minimum, maximum, or range)
- Activity level and deficit/surplus severity presets for suggested calorie targets
- Preferred weight and height units (lbs/kg, ft-in/cm)
- Date of birth for age-based calculations
- Full onboarding modal on first sign-in to capture starting stats

### PWA
- Installable on mobile and desktop
- Offline-capable via service worker
- Mobile-optimized bottom navigation bar

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | react-router-dom v7 |
| Backend / Auth | Supabase (PostgreSQL + Row Level Security) |
| Styling | Inline styles + `src/styles.css`; Bootstrap 5 available |
| PWA | `vite-plugin-pwa` / Workbox |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Install & Run

```bash
npm install
npm run dev       # dev server at http://localhost:5173/
npm run build     # production build
npm run preview   # preview production build
```

---

## Database

Run the SQL in `supabase/migrations.sql` in your Supabase SQL editor to create all required tables and RLS policies.

Key tables:

| Table | Purpose |
|---|---|
| `nutrition_goals` | Per-user macro targets, preferred units, starting/current weight |
| `food_log` | Daily food entries |
| `custom_foods` | User-saved food library |
| `weight_logs` | Daily weight entries (PK: `user_id, date`) |
| `daily_goal_status` | Per-day goal completion status + goals snapshot |
| `workout_logs` | Exercise session entries |
| `saved_routines` | Named exercise routines |

---

## Project Structure

```
src/
  App.jsx                  # Top-level routes and nav
  main.jsx                 # React entry point
  styles.css               # Global styles
  pages/
    DiagramPage.jsx        # Interactive muscle diagram
    Videos.jsx             # Exercise video library
    Nutrition.jsx          # Food logging and macro tracking
    Profile.jsx            # User settings, goals, and weight history
    ExerciseLogger.jsx     # Workout logging
  components/
    HumanDiagram.jsx             # Male front SVG diagram
    HumanDiagramBack.jsx         # Male back SVG diagram
    HumanDiagramFemaleFront.jsx  # Female front SVG diagram
    HumanDiagramFemaleBack.jsx   # Female back SVG diagram
    NutritionCalendar.jsx        # Food history calendar
    OnboardingModal.jsx          # First-run setup modal
    BottomNav.jsx                # Mobile navigation bar
  data/
    muscles.js             # Muscle group definitions and exercises
    videos.js              # Exercise name → YouTube URL map
supabase/
  migrations.sql           # All DB schema and RLS policy definitions
```
