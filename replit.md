# SnapGen - Snapchat Chat Simulator & Video Maker

## Overview

SnapGen is a high-fidelity Snapchat chat simulator that allows users to create realistic iOS-style chat exchanges and export them as vertical videos (for TikTok, etc.). The app simulates Snapchat's UI including the status bar, chat header with Bitmoji avatars, message bubbles, typing indicators, an iOS keyboard, presence pills, customoji/sticker suggestions, and sound effects. It uses Google's Gemini AI to generate conversations and profile pictures.

The project follows a fullstack monorepo pattern with a React frontend in `client/` and an Express backend in `server/`, sharing types and schema through `shared/`. However, the core application logic is almost entirely client-side — the backend currently serves as a minimal shell for serving the SPA and providing a future API layer.

There is also a `temp_extract/` directory containing the original standalone version of the app (from Google AI Studio). The canonical code lives in `client/src/` — the temp_extract folder is reference material only and should not be modified.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite with HMR support
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives — located in `client/src/components/ui/`
- **State Management**: Local React state (useState/useEffect) — no external state library
- **Data Fetching**: TanStack React Query with a custom `apiRequest` helper in `client/src/lib/queryClient.ts`
- **Fonts**: Avenir Next LT Pro (loaded from CDN), DM Sans, Fira Code, Geist Mono (Google Fonts)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Key Frontend Services
- **`geminiService.ts`**: Calls Google Gemini API directly from the client using `@google/genai`. Uses `import.meta.env.VITE_GEMINI_API_KEY` for the API key. Generates conversations and AI profile pictures.
- **`bitmojiService.ts`**: Renders Bitmoji avatars using the Bitmoji SDK CDN. Maintains a pool of avatar IDs and generates selfie/peeking URLs.
- **`customojiService.ts`**: Loads a sticker catalog from `templates.json` (in `client/public/`) and provides tag-based search for sticker suggestions.
- **`soundService.ts`**: Manages keyboard click sounds, notification sounds, and sound effects using Web Audio API. Supports MediaRecorder integration for video export.

### Key Frontend Components
- **`App.tsx`**: Main application component containing all state (cast members, script events, system config, chat config) and the playback/recording engine
- **`StatusBar.tsx`**: iOS-style status bar with signal, carrier, time, WiFi, battery
- **`ChatHeader.tsx`**: Snapchat-style chat header with avatar, name, call icons
- **`ChatInput.tsx`**: Message composition area with customoji suggestions
- **`IOSKeyboard.tsx`**: Pixel-perfect iOS keyboard replica (alpha, numeric, symbols layouts)
- **`PresencePills.tsx`**: Group chat presence indicators with Bitmoji peeking
- **`TypingBubble.tsx`**: Animated Snapchat typing indicator

### Backend (server/)
- **Framework**: Express.js on Node.js with TypeScript
- **Runtime**: `tsx` for development, esbuild for production builds
- **Entry Point**: `server/index.ts` creates HTTP server, registers routes, serves static files
- **Routes**: `server/routes.ts` — currently a skeleton, all routes should be prefixed with `/api`
- **Storage**: `server/storage.ts` — implements an `IStorage` interface with an in-memory implementation (`MemStorage`). Designed to be swapped for a database-backed implementation.
- **Static Serving**: In production, serves built client from `dist/public/`. In development, uses Vite dev server middleware (`server/vite.ts`).

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` — currently has a `users` table (id, username, password)
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Managed via `drizzle-kit push` (schema push, no migration files)
- **Connection**: Requires `DATABASE_URL` environment variable
- **Note**: The in-memory storage is currently active. To use Postgres, swap `MemStorage` for a Drizzle-backed implementation.

### Build System
- **Client Build**: Vite builds to `dist/public/`
- **Server Build**: esbuild bundles server to `dist/index.cjs`, with selective dependency bundling (allowlisted deps are bundled, others are external)
- **Script**: `script/build.ts` orchestrates both builds

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required for DB features)
- `VITE_GEMINI_API_KEY` — Google Gemini API key (used client-side for AI features)

## External Dependencies

### AI / Generative
- **Google Gemini API** (`@google/genai`): Used client-side for conversation generation and AI avatar/profile picture creation. Requires `VITE_GEMINI_API_KEY`.

### External Assets (CDN)
- **Bitmoji SDK**: Avatar rendering via `sdk.bitmoji.com` URLs
- **GitHub-hosted assets**: UI icons, sound effects, and fonts loaded from `raw.githubusercontent.com/truls-dev/`
- **Font Awesome**: Icon library loaded from CDN
- **Google Fonts**: DM Sans, Fira Code, Geist Mono

### Database
- **PostgreSQL**: Via `DATABASE_URL` environment variable
- **Drizzle ORM**: Schema management and query building
- **connect-pg-simple**: Session store (available but not yet wired up)

### Key NPM Packages
- **Video Export**: `mp4-muxer` for client-side video encoding
- **UUID**: `uuid` for generating unique IDs
- **Radix UI**: Full suite of accessible UI primitives
- **shadcn/ui**: Pre-built component library on top of Radix
- **TanStack React Query**: Server state management
- **Zod**: Runtime type validation
- **express-session / passport**: Available for auth (not yet implemented)