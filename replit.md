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
- **`canvasRenderer.ts`**: Native 1080x1920 canvas-based renderer for HD video export. Draws all UI elements programmatically (status bar, header, messages, typing indicators, presence pills, input, keyboard). Supports video background mode, short crop, export background images, and group icons. Uses WebCodecs VideoEncoder for frame encoding — no screen capture required.
- **`geminiService.ts`**: Calls Google Gemini API directly from the client using `@google/genai`. Uses `import.meta.env.VITE_GEMINI_API_KEY` for the API key. Generates conversations and AI profile pictures.
- **`bitmojiService.ts`**: Renders Bitmoji avatars using the Bitmoji SDK CDN. Maintains a pool of avatar IDs and generates selfie/peeking URLs.
- **`customojiService.ts`**: Loads a sticker catalog from `templates.json` (in `client/public/`) and provides tag-based search for sticker suggestions.
- **`soundService.ts`**: Manages keyboard click sounds, notification sounds, sound effects, and background music using Web Audio API. Offline audio rendering uses direct Float32Array sample mixing (no OfflineAudioContext) to prevent audio fading in long videos and memory exhaustion crashes. Resampling cache avoids duplicate buffer allocations. Background music loaded from `github.com/truls-dev/music`, with preview playback, volume control, and automatic looping for videos longer than the track.

### Notable App Features
- **Timed Sound Effects**: Fire sound effects at specific timestamps independent of the script timeline. Uses Web Worker timers during recording for background tab resilience.
- **Outro Video Append**: Upload a WEBM/MP4 video (e.g., subscribe animation) to append to the end of exported videos. Uses `requestVideoFrameCallback` for reliable frame extraction with seek-based fallback. Audio from the outro video is decoded, resampled to match, and stitched after the main audio.
- **Background Tab Export**: Recording uses Web Worker-based timers (`createWorkerTimer()` in App.tsx) instead of regular `setTimeout` to prevent browser throttling when tab is inactive. The render loop uses `setTimeout(renderLoop, 0)` instead of `requestAnimationFrame` with a large batch size (120 frames) for catch-up rendering.
- **iOS Notification Banners**: Script events of type `IOS_NOTIFICATION` trigger slide-in/out notification overlays (Snapchat or Messages platform). Stored in `scriptNotificationsRef` during playback, filtered by real frame time in render loops. Also supports timed notifications from the Settings tab.
- **Lockscreen Intro**: Toggle in Settings to start playback on an iPhone lockscreen before transitioning to chat. Shows status bar (white icons), date text, large clock time, and a Snapchat notification banner built from the first non-me message. Customizable wallpaper image, date/time text, and duration. State stored in `lockscreenActiveRef` and `lockscreenNotifRef` refs read directly by render loops.

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
- **Schema**: Defined in `shared/schema.ts` — has `users` table (id, username, password) and `exports` table (id, file_name, r2_key, file_size, duration_ms, created_at)
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Managed via `drizzle-kit push` (schema push, no migration files)
- **Connection**: Requires `DATABASE_URL` environment variable
- **Note**: The in-memory storage is currently active for both users and export records. Export records persist within session but reset on server restart.

### Build System
- **Client Build**: Vite builds to `dist/public/`
- **Server Build**: esbuild bundles server to `dist/index.cjs`, with selective dependency bundling (allowlisted deps are bundled, others are external)
- **Script**: `script/build.ts` orchestrates both builds

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required for DB features)
- `VITE_GEMINI_API_KEY` — Google Gemini API key (used client-side for AI features)
- `R2_ACCESS_KEY_ID` — Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY` — Cloudflare R2 secret key
- `R2_ENDPOINT` — Cloudflare R2 endpoint URL
- `R2_BUCKET_NAME` — Cloudflare R2 bucket name (default: snapgen-exports)

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