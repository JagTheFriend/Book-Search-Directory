# 📚 Book Search Directory

A responsive book search app built for **Assignment #3 (Movie or Book Search Directory)** — I picked **books** because the Open Library API is completely free and **requires no API key** (OMDB/TMDB both require one).

Search millions of books by title, author, or topic and browse the results in a responsive CSS Grid of cards with cover, title, authors, and release year.

**Tech stack:** Next.js 16 (App Router, `cacheComponents` + `partialPrefetching`) · React 19 · TypeScript · Tailwind CSS 4 · [next-safe-action](https://next-safe-action.dev) 8 + Zod 4 (typed Server Actions) · Vitest · Playwright · Biome

**Live data source:** [Open Library Search API](https://openlibrary.org/dev/docs/api/search) — free, no key, CORS-friendly.

---

## Features

### Core requirements

| Requirement | Implementation |
| --- | --- |
| Free third-party API, no key | Open Library Search API, called **server-side** (no CORS exposure) |
| Search bar fetching on input | Debounced (400 ms) input → typed Server Action → normalized results |
| Responsive CSS Grid of cards | 2 → 3 → 4 → 5 columns (phone → tablet → laptop → desktop), 24 results per page |
| Cards show title, year, cover | Cover (`next/image`), title, authors, release-year badge; graceful placeholders when data is missing |
| "No results found" state | Dedicated empty state with the query echoed back and suggestion chips |

### Stretch goals

- ✅ **Debounce** — custom `useDebounce` hook; one action call per typing pause (asserted in both test suites)
- ✅ **Loading skeleton** — shimmer skeleton grid while searching, plus a full-page skeleton streamed on first load
- ✅ **Bonus:** error state with retry, URL sync (`?q=`, shareable/reloadable), SSR of results, accessibility (persistent live region for status announcements, labels, reduced-motion support for the skeleton shimmer)

## Quick start

Requires **Node.js ≥ 20.9** (the floor set by Next.js 16; tested on Node 26 — also enforced via `engines` in `package.json`).

```bash
npm install
npm run dev        # http://localhost:3000 (see “Running locally & ports”)
```

### Running locally & ports

| Process | Port | Set by |
| --- | --- | --- |
| `npm run dev` | 3000 | `next dev` default (`-p`/`--port` or `PORT` override) |
| `npm start` | 3000 | `next start` default (same overrides) |
| Playwright app under test | 3100 | `playwright.config.ts` |
| Playwright mock Open Library API | 3200 | `e2e/mock-api.mjs` |

- The E2E suite uses 3100/3200 so `npm run test:e2e` can run while a dev server holds 3000.
- If 3000 is busy, plain `npm run dev` does not fail — Next logs *"Port 3000 is in use by process \<pid\>, using available port 3001 instead."* and retries up to +10. An explicit `--port`/`PORT` disables retries (hard `EADDRINUSE` exit), and `npm start` never retries.
- Custom port: `npm run dev -- -p 3100` (or `PORT=3101 npm run dev`); `npm run build && npm start -- -p 3200` (or `PORT=3200 npm start`).
- `test:e2e` always builds and starts **fresh** servers on 3100/3200 (no reuse — a stale server could silently run the suite against the real API) and shuts them down when it finishes.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit + component tests (jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end suite (builds + starts prod + mock API itself) |
| `npm run typecheck` | Route typegen + `tsc --noEmit` |
| `npm run lint` / `npm run format` | Biome checks / formatter |

## How it works

The URL (`?q=`) is the single source of truth; the server renders results, and the client keeps it in sync while you type.

```
GET /?q=dune
   └─ app/page.tsx (sync Server Component)
        └─ <Suspense fallback={<PageSkeleton/>}>        ← cacheComponents requires the
             └─ <SearchExperience/>  (async Server)        dynamic read behind Suspense
                  ├─ await searchParams  → query
                  ├─ await connection()  → request-time only (no fetches during build)
                  ├─ searchBooks(query)   → Open Library fetch + normalization
                  └─ <SearchDirectory initialQuery initialResults initialError/>  (Client)

Typing in <SearchDirectory>
   └─ useDebounce(400ms) → useAction(searchBooksAction).executeAsync({ q })
        └─ Server Action ("use server", next-safe-action)
             ├─ Zod validates/trims the input before any network call
             ├─ fetches Open Library server-side, returns { books, totalFound }
             └─ client applies the result (stale-response guarded)
                and mirrors it into the URL via history.replaceState
```

Design decisions worth knowing:

- **Why a Server Action instead of a client `fetch`?** The assignment focuses on asynchronous JavaScript; `next-safe-action` gives validated, fully-typed input (`zod`), a single normalized result type across the RSC boundary, and clean loading/error semantics via `useAction` — while the Open Library call itself never leaves the server (no CORS, no exposed API details).
- **Race conditions:** `executeAsync` results are guarded by an "active query" ref, so a slow response can never overwrite a newer search.
- **Streaming:** with `cacheComponents` enabled, the page paints a skeleton immediately and streams results in — plus `await connection()` ensures `next build` never makes network calls.
- **Covers:** `next/image` with a strict `images.remotePatterns` allowlist for `covers.openlibrary.org`; every cover renders a tiny blurred placeholder (LQIP) until the real image loads, so cards are never blank; books without covers (or whose cover 404s at runtime) fall back to a styled placeholder.
- **Configurability:** `OPEN_LIBRARY_SEARCH_URL` overrides the API endpoint (used by the hermetic E2E suite).

## Project structure

```
app/
  actions/search-books.ts   # "use server" — validated search Server Action
  page.tsx                  # sync page → <Suspense> + streaming boundary
  layout.tsx, globals.css   # metadata, fonts, skeleton shimmer keyframes
  favicon.ico
components/
  search-experience.tsx     # async Server Component: ?q= → fetch → hydrate shell
  search-directory.tsx      # client shell: debounce, action call, state machine
  book-card.tsx             # cover / placeholder / year badge
  results-grid.tsx          # the responsive CSS Grid
  search-states.tsx         # idle / empty ("No results found") / error / meta
  skeletons.tsx             # page + grid + card skeletons, loading line
  icons.tsx                 # inline SVGs (no icon dependency)
hooks/use-debounce.ts       # generic debounce hook
lib/
  openlibrary.ts            # typed API client: URL building + safe normalization
  safe-action.ts, schemas.ts, messages.ts
e2e/                        # Playwright suite + deterministic mock API
e2e/mock-api.mjs            # local stand-in for the Open Library API (port 3200)
lib/*.test.ts, components/*.test.tsx, hooks/*.test.tsx   # Vitest suites
next.config.ts              # cacheComponents, partialPrefetching, images.remotePatterns
playwright.config.ts        # E2E: prod build on 3100 + mock API on 3200
vitest.config.mts, vitest.setup.ts   # jsdom test env + next/image stub
biome.json, tsconfig.json   # lint/format + TS config
```

## Testing

Two suites, both green (53 + 15 tests):

- **Vitest (53 tests)** — API client (URL building, normalization, dedupe, missing fields, non-2xx/network failures, upstream timeout, malformed-response guard), SSR param parsing (default/empty/whitespace/array/oversized `?q=`), Zod schema bounds, `useDebounce` timing with fake timers, and component tests for every UI state (SSR-data reuse, debounce-coalescing, skeleton, no-results, error + retry, URL sync, clear/idle, Enter-to-search, in-flight dedupe, live-region announcements, cover fallbacks). Follows the [official Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest).
- **Playwright (15 tests)** — runs against a **production build** with `OPEN_LIBRARY_SEARCH_URL` pointed at a local mock (`e2e/mock-api.mjs`), so it's fully deterministic and offline. Covers the full flows above, the live image-optimizer pipeline, plus a **responsive matrix** (320/390/768/1100/1440 px) asserting no horizontal overflow, real first-row grid column counts, and that the search input always fits.

```bash
npm test          # unit + component
npm run test:e2e  # end-to-end (auto build + start + mock API on 3100/3200, auto-shutdown)
```

> First E2E run only: `npx playwright install chromium` (the suite uses the default Chromium project).

I also smoke-tested the production server against the **live** API: SSR results, the empty state, and the image optimizer all verified, then shut the server down.

## Deployment (manual)

The app is a standard Next.js server app — **Vercel or Netlify work with zero code changes**:

**Vercel**

```bash
npm i -g vercel && vercel login
vercel            # first deploy
vercel --prod     # production
```

…or push the repo and "Import Project" at [vercel.com/new](https://vercel.com/new) (framework auto-detected).

**Netlify**

```bash
npm i -g netlify-cli && netlify login
netlify deploy --build --prod
```

…or connect the repo at [app.netlify.com](https://app.netlify.com) (the Next.js plugin is auto-detected).

> ⚠️ **Why not GitHub Pages / static export?** This app uses **Server Actions**, which require a server runtime — `output: 'export'` explicitly does not support them. That's the tradeoff for the SSR + `next-safe-action` architecture requested for this assignment. Everything else (search, results, empty/error states) works without client-side API calls precisely *because* rendering happens server-side.

## Challenges faced (and how they were solved)

1. **`cacheComponents` requires Suspense around dynamic reads** — reading `searchParams` at the top level of the page broke the static shell. The page component stays synchronous, passes the *promise* into an async child wrapped in `<Suspense>` (streamed skeleton fallback).
2. **`"use server"` files may only export async functions** — exporting a `const` error message from the action module fails the build (verified in Next's SWC). Messages moved to `lib/messages.ts`.
3. **Prerender-time fetches** — the default-query fetch originally attempted (and rejected with `HANGING_PROMISE_REJECTION`) during `next build`. `await connection()` in the async server component defers all fetching to request time: clean builds, no network calls while building.
4. **`next-safe-action` masks server errors by default** — the default `handleServerError` returns a generic string. `returnServerError()` returns a friendly, expected error to the client while raw upstream errors stay in server logs.
5. **Debounce + async race conditions** — out-of-order responses could show stale results; guarded with an "active query" ref that drops superseded responses.
6. **Next 16 `next/image` changes** — `images.domains` is deprecated (→ `remotePatterns`) and cover URLs redirect through `archive.org` (within the 3-redirect limit); verified during manual smoke testing that the optimizer serves real JPEGs.
7. **Flaky responsive assertion** — `getComputedStyle(el).gridTemplateColumns` sometimes returns the *specified* value (`repeat(3, minmax(0, 1fr))` → 3 tokens) instead of the resolved columns; switched to measuring actual card geometry (first-row card count). Also added a visibility wait for React's streaming "hidden reveal" container before measuring.
8. **Dependency skew** — `vitest@5` requires `@types/node ≥ 22`; the scaffold had `^20` while the runtime is Node 26 → upgraded the types instead of forcing `--legacy-peer-deps`.
9. **No timeout on the upstream fetch** — a code review pass caught that `searchBooks` could hang indefinitely: in SSR that stalls the whole stream (user stuck on the skeleton with an uninteractive page), and since Next.js serializes Server Actions per client, one hung request would queue every later search behind it. Fixed with `AbortSignal.timeout(8_000)`, plus an 8-second budget that turns a dead upstream into the normal error-and-retry state.

## API notes

- Endpoint: `https://openlibrary.org/search.json?q=…&limit=24&fields=key,title,subtitle,author_name,first_publish_year,cover_i` (field-limited for small payloads).
- Covers: `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`.
- Open Library asks for reasonable use (currently 1 request/second anonymous, 3 req/s with an identified User-Agent); the 400 ms debounce + 8 s request timeout keep us far below that, and the mock API keeps the test suites offline.
- Missing fields are common (`cover_i`, `first_publish_year`, `author_name`) — the normalizer maps them to `null`/`[]` and the UI renders placeholders instead of breaking.
