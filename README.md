# Study Arcade (LLM Games)

A design-forward study/learning app built with Next.js where users create decks from pasted text, PDF uploads, or topic prompts, then play mini-games generated from deck content.

The app is local-first (no auth, localStorage persistence) and uses configurable LLM providers via the Vercel AI SDK.

## Features

- Create study decks from:
  - pasted text
  - uploaded PDF (server-side text extraction)
  - topic prompt
- Optional **Tutor Focus** prompt during deck creation to guide what the user wants to learn
- Configurable AI provider/model/API key:
  - OpenAI
  - Anthropic
  - Google
- Full light/dark theme toggle with branded UI
- Centralized AI Tutor popup available on all screens
- Deck-scoped tutor chat (`Chat Bot Tutor` game and popup share the same conversation)
- Markdown + GFM rendering in tutor chats
- Local storage persistence for:
  - decks
  - generated game data cache
  - AI settings
  - theme preference
- GSAP-powered interactions/animations throughout the app

## Games (Implemented)

The app currently includes **13** game modes (the original 12 plus an additional `Hungry Bug` mode):

1. `Study Table`
2. `Flashcards`
3. `Quiz`
4. `Matching`
5. `Type In`
6. `Chat Bot`
7. `Unscramble`
8. `Snowman`
9. `Hungry Bug`
10. `Bug Match`
11. `Chopped`
12. `Crossword`
13. `Test Mode`

Note: `Hungry Bug` was added after the original 12-game plan, so the app now ships with 13 playable game types.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: SCSS Modules + Tailwind CSS (`@apply`)
- **Animation**: GSAP
- **AI SDK**: Vercel AI SDK (`ai` + provider packages)
- **Schema Validation**: Zod
- **PDF Extraction**: `pdfjs-dist` (server-side via local API route)
- **Markdown Rendering**: `react-markdown` + `remark-gfm`
- **Crossword Layouts**: `crossword-layout-generator`

## Project Status

- Foundation, AI pipeline, dashboard/create flow, game wrapper, and all game groups (A/B/C) are implemented.
- The project is functional and playable end-to-end.
- Additional polish/refinement work (visual tuning, balance, UX edge cases) is still ongoing.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Configure your AI provider

Go to `/settings` and save:

- provider (`openai`, `anthropic`, `google`)
- model name
- API key

This is stored in **browser localStorage** (MVP behavior).

### 4. Configure GA4 (optional)

Set these environment variables before running in production:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA_API_SECRET=your_measurement_protocol_secret
# Optional for QA in non-production:
# NEXT_PUBLIC_ANALYTICS_FORCE=true
```

Analytics is explicit opt-in, session-scoped, and privacy-sanitized by default.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## App Routes

- `/` — Dashboard (study deck list)
- `/create` — Create a new study deck (Text / PDF / Topic)
- `/set/[id]` — Deck game selector grid
- `/set/[id]/[game]` — Individual game view
- `/settings` — AI provider/model/key + game/deck limits
- `/api/generate` — LLM generation (terms + game data)
- `/api/chat` — Streaming AI tutor responses
- `/api/pdf-extract` — PDF text extraction

## How It Works

### Deck Creation

1. User enters content (text / PDF / topic)
2. Optional **Tutor Focus** prompt narrows what they want to learn
3. App calls `/api/generate` to extract term/definition pairs (with fallback local generation)
4. User reviews/edits terms
5. Deck is saved to localStorage

### Game Data Generation

- On first visit to a game, the app generates structured data for that mode (LLM or local fallback)
- Game data is cached in the deck (`gameData`) in localStorage
- Future visits reuse cached data unless regenerated/reset

### Tutor System

- Global popup tutor is available on all screens
- `Chat Bot Tutor` game and popup share the same deck-scoped session
- `Quiz` includes **AI Explain** actions that open the tutor and prefill/send explanation prompts
- Tutor supports Markdown/GFM responses

## Settings (Important)

In `/settings`, you can configure:

- AI provider/model/API key
- **Max Terms Per Deck**
- **Max Cards/Items Per Game**

These caps are used in deck generation and game data generation to reduce oversized decks/games.

## PDF Upload Notes

PDF extraction runs through a local Next.js API route (`/api/pdf-extract`) and parses on the server side.

If PDF uploads fail after a code update:

1. Restart `npm run dev`
2. Hard refresh the browser

## Local-First MVP Caveats

- No auth / no cloud sync
- API keys are stored in browser localStorage (MVP only)
- Data is tied to the browser profile + origin/port (e.g. `localhost:3000` vs `localhost:3001` are separate)
- Clearing site data removes saved decks/settings

## Folder Structure (High Level)

```text
src/
  app/
    api/
    create/
    set/[id]/
    settings/
  components/
    games/
    ui/
    layout/
    create/
    dashboard/
  lib/
    ai/
    storage.ts
    theme.tsx
    gsap.ts
    pdf.ts
    chat-tutor.tsx
  styles/
  types/
```

## Known Notes / Tradeoffs

- LLM output can be inconsistent; the app includes local fallback generation and normalization for several games.
- Crossword layouts are generated from term/clue pairs and may omit some entries if they cannot be placed by the layout generator.
- Existing cached game data may need regeneration after changing settings caps.

## Credits

- Built with Next.js + Vercel AI SDK
- Crossword layouts powered by [Crossword-Layout-Generator](https://github.com/MichaelWehar/Crossword-Layout-Generator)
