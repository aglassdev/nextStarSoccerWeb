# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # TypeScript check + Vite production build
npm run preview    # Preview production build locally
npm run lint       # ESLint with zero warnings tolerance
./check-env.sh     # Validate required environment variables before running
```

No test suite is configured.

## Architecture

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS, deployed on Vercel with Appwrite as the backend (auth, database, storage, functions) and Stripe for payments.

**Path alias:** `@` maps to `./src/`

### Key Layers

**Authentication (`src/contexts/AuthContext.tsx`)** — Single context wrapping the entire app. Provides `user`, `session`, `loading`, `login`, `logout`, and `signup`. All pages consume this via `useAuth()`. `ProtectedRoute` in `App.tsx` reads from this context.

**Appwrite service (`src/services/appwrite.ts`)** — Exports singleton instances (`account`, `databases`, `storage`, `functions`) and all collection ID constants sourced from `VITE_APPWRITE_*` env vars. Guards against undefined env vars with empty string fallbacks. Pages import these directly rather than calling Appwrite SDK themselves.

**Routing (`src/App.tsx`)** — React Router v6. Public routes are open; dashboard, billing, profile, and events routes are wrapped in `ProtectedRoute`.

**Types (`src/types/index.ts`)** — Single file with all domain interfaces: `User`, `Session`, `YouthPlayer`, `CollegiatePlayer`, `TeamTrainingEvent`, `EventSignup`, `EventCheckin`, `Bill`, `BillItem`, `Payment`, `FamilyRelationship`, `FamilyInvitation`, `Message`.

**Admin config (`src/constants/adminConfig.ts`)** — Hardcoded admin user IDs for privilege checks.

**Google Calendar (`src/services/googleCalendar.ts`)** — Fetches events from Google Calendar API for the calendar pages. Handles EST timezone conversion and detects cancellations by parsing event descriptions.

### Styling

Dark-mode-only app. Background is `#000000`. Primary color `#1E40AF` (blue), secondary `#10B981` (green). Custom font: LT Wave (falls back to Inter/system-ui). Custom Tailwind token `gray-750` = `#2D3748`. Tailwind config is in `tailwind.config.js`.

### Environment Variables

All prefixed with `VITE_APPWRITE_`. Required: `ENDPOINT`, `PROJECT_ID`, `DATABASE_ID`, plus one `*_COLLECTION_ID` per collection (parent_users, youth_players, collegiate_players, professional_players, team_training, coaches, signups, checkins, coach_signups, coach_checkins, messages, bills, bill_items, payments, family_relationships_001, family_invitations_001, website_inquiries). Also `VITE_STRIPE_PUBLISHABLE_KEY`. See `.env.example`.

### Deployment

Vercel with `vercel.json` rewriting all routes to `/` for client-side routing. Push to `main` triggers auto-deploy.