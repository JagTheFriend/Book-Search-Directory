/**
 * Typed client for the Open Library Search API.
 *
 * @see https://openlibrary.org/dev/docs/api/search
 *
 * Chosen over OMDB/TMDB because it is fully free, requires no API key,
 * sends permissive CORS headers, and covers books — matching this project's
 * repository name and the assignment's "free API" constraint.
 */

import { cacheLife } from "next/cache";

/**
 * Search endpoint (JSON). Overridable via `OPEN_LIBRARY_SEARCH_URL` for
 * tests / self-hosting.
 */
export const OPEN_LIBRARY_SEARCH_ENDPOINT =
  process.env.OPEN_LIBRARY_SEARCH_URL ?? "https://openlibrary.org/search.json";

/** Cover image host, e.g. `https://covers.openlibrary.org/b/id/8231856-M.jpg`. */
export const COVER_IMAGE_ENDPOINT = "https://covers.openlibrary.org/b/id";

/** Query used when the URL has no `?q=` parameter, so the grid renders on first paint (SSR). */
export const DEFAULT_QUERY = "harry potter";

/**
 * Page size. Divisible by 2/3/4 columns so those breakpoints fill cleanly;
 * the 5-column layout simply ends with a partial last row (a multiple of 60
 * would leave an awkward sparse grid at 24 results anyway).
 */
export const RESULTS_PER_QUERY = 24;

/**
 * Hard timeout for the upstream search request. A hung request would stall
 * SSR streaming (user stares at the skeleton with no interactive input) and,
 * since Next.js serializes Server Actions per client, queue every later
 * search from that user behind it.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Requesting only the fields we render keeps payloads small (~60% smaller
 * than the default response) and speeds up the server action.
 */
const SEARCH_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "first_publish_year",
  "cover_i",
] as const;

/** Normalized shape rendered by the UI and passed from Server → Client Components. */
export type Book = {
  /** Open Library work key, e.g. `/works/OL82563W`. Stable unique identifier. */
  id: string;
  title: string;
  authors: string[];
  /** `null` when Open Library has no publication year for the work. */
  firstPublishYear: number | null;
  /** Absolute cover URL, `null` when no cover exists (UI renders a placeholder). */
  coverUrl: string | null;
};

export type SearchResult = {
  books: Book[];
  /** Total matches Open Library found (may exceed `books.length`). */
  totalFound: number;
};

/** Raw fields we ask for. Every field is optional — the API omits missing values. */
type OpenLibraryDoc = {
  key?: string;
  title?: string;
  subtitle?: string | string[];
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

type OpenLibraryResponse = {
  numFound?: number;
  docs?: OpenLibraryDoc[];
};

/** Builds the request URL for a query, limiting fields and page size. */
export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    limit: String(RESULTS_PER_QUERY),
    fields: SEARCH_FIELDS.join(","),
  });
  return `${OPEN_LIBRARY_SEARCH_ENDPOINT}?${params.toString()}`;
}

/** Cover URL for a cover id. `-L` (~large) keeps covers crisp on high-DPI screens. */
export function coverImageUrl(coverId: number): string {
  return `${COVER_IMAGE_ENDPOINT}/${coverId}-L.jpg`;
}

function normalizeTitle(doc: OpenLibraryDoc): string | null {
  const title = typeof doc.title === "string" ? doc.title.trim() : "";
  if (title === "") return null;

  const rawSubtitle = Array.isArray(doc.subtitle)
    ? doc.subtitle.join(": ")
    : doc.subtitle;
  const subtitle = typeof rawSubtitle === "string" ? rawSubtitle.trim() : "";
  if (subtitle === "" || subtitle.toLowerCase() === title.toLowerCase())
    return title;
  return `${title}: ${subtitle}`;
}

/**
 * Maps a raw Open Library doc to a {@link Book}, or `null` when the doc is
 * unusable (missing id/title). Never throws on malformed payloads.
 */
export function normalizeDoc(doc: OpenLibraryDoc): Book | null {
  const id = typeof doc.key === "string" ? doc.key.trim() : "";
  const title = normalizeTitle(doc);
  if (id === "" || title === null) return null;

  const authors = Array.isArray(doc.author_name)
    ? doc.author_name.filter(
        (author) => typeof author === "string" && author.trim() !== "",
      )
    : [];

  return {
    id,
    title,
    authors,
    firstPublishYear:
      typeof doc.first_publish_year === "number"
        ? doc.first_publish_year
        : null,
    coverUrl:
      typeof doc.cover_i === "number" ? coverImageUrl(doc.cover_i) : null,
  };
}

/** Normalizes a doc list, dropping unusable entries and duplicates (Open Library repeats works across editions). */
export function normalizeDocs(
  docs: readonly OpenLibraryDoc[] | undefined,
): Book[] {
  if (!docs) return [];

  const seen = new Set<string>();
  const books: Book[] = [];
  for (const doc of docs) {
    const book = normalizeDoc(doc);
    if (book === null || seen.has(book.id)) continue;
    seen.add(book.id);
    books.push(book);
  }
  return books;
}

/**
 * Characters Open Library's Solr backend treats as query operators. A query
 * made only of these is rejected outright by the API (verified live:
 * `":"`, `"&&"`, `""`, `"-"` → 422; `"***"` → 500), and stray operators can
 * break the parser mid-query — so each is replaced with a space and the
 * leftover whitespace is collapsed before the request goes out. Apostrophes
 * are deliberately kept: the API accepts them (`"it's"` → 200).
 */
const SOLR_SPECIAL_CHARACTERS = /[+\-&|!(){}[\]^"~*?:\\/]/g;

/** Makes user input safe for Open Library's Solr query parser. */
export function sanitizeQuery(query: string): string {
  return query
    .replace(SOLR_SPECIAL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Searches Open Library and returns normalized results.
 *
 * Throws an `Error` when the request fails (network error, non-2xx response,
 * or malformed JSON). Callers — the server action — translate that into a
 * user-facing message, so raw upstream errors are never leaked to the client.
 */
export async function searchBooks(query: string): Promise<SearchResult> {
  // Blank input — and input that is nothing but Solr operators once
  // sanitized — degrades to an empty result instead of an upstream 422/500.
  const searchTerm = sanitizeQuery(query);
  if (searchTerm === "") return { books: [], totalFound: 0 };

  return fetchSearchResults(searchTerm);
}

/**
 * Fetch + normalize pipeline, wrapped in Next.js `"use cache"` (Cache
 * Components model): the normalized response is cached **keyed by the
 * sanitized query**, and the SSR path and the Server Action share the same
 * entry — repeat searches (any user, same query) are served from the cache
 * without re-hitting Open Library, which also keeps us well under its
 * anonymous rate limit. The `hours` profile (stale 5 min → serve instantly
 * and revalidate in the background every hour → expire after 1 day) suits a
 * catalog that changes slowly. Thrown errors are never cached, so the
 * error → retry flow always re-fetches.
 */
async function fetchSearchResults(searchTerm: string): Promise<SearchResult> {
  "use cache";
  cacheLife("hours");

  const response = await fetch(buildSearchUrl(searchTerm), {
    headers: { accept: "application/json" },
    // Bound the upstream request so a slow/hung API can't stall SSR
    // streaming or block the per-client Server Action queue (see timeout doc).
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Open Library search failed with status ${response.status} for q="${searchTerm}"`,
    );
  }

  const data = (await response.json()) as OpenLibraryResponse;
  const books = normalizeDocs(data.docs);
  const totalFound =
    typeof data.numFound === "number" ? data.numFound : books.length;

  // The API claims matches but every doc was normalized away (API drift or
  // schema change) — throw so callers show an error, not a false
  // "No results found" empty state.
  if (totalFound > 0 && books.length === 0) {
    throw new Error("Open Library returned no usable books");
  }

  return { books, totalFound };
}
