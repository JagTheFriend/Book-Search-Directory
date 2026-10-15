import { connection } from "next/server";
import { SEARCH_FAILED_MESSAGE } from "@/lib/messages";
import {
  DEFAULT_QUERY,
  type SearchResult,
  searchBooks,
} from "@/lib/openlibrary";
import { SearchDirectory } from "./search-directory";

type Props = {
  /** The route's `searchParams` **promise** — awaited here, inside the page's `<Suspense>`. */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Async Server Component: resolves `?q=`, fetches results **server-side**, and
 * hydrates the interactive search shell with initial data.
 *
 * - No `q` param  → fetch {@link DEFAULT_QUERY} so the grid SSRs on first paint.
 * - `q` present but empty (`/?q=`) → idle state, no fetch.
 * - Fetch fails   → shell still renders, in its error state (page never crashes).
 */
export async function SearchExperience({ searchParams }: Props) {
  const params = await searchParams;
  const rawQuery = params.q;
  const query =
    rawQuery === undefined
      ? DEFAULT_QUERY
      : (Array.isArray(rawQuery) ? (rawQuery[0] ?? "") : rawQuery).trim();

  if (query === "") {
    return (
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />
    );
  }

  let initialResults: SearchResult | null = null;
  let initialError: string | null = null;

  // Defer the upstream fetch to request time: the static shell (the streaming
  // fallback) stays prerenderable and `next build` never makes network calls.
  // Deliberately *outside* the try/catch — during prerendering this rejection
  // is expected React control flow (the subtree is discarded), not a failure.
  await connection();

  try {
    initialResults = await searchBooks(query);
  } catch (error) {
    console.error("[search-experience] SSR fetch failed:", error);
    initialError = SEARCH_FAILED_MESSAGE;
  }

  return (
    <SearchDirectory
      initialQuery={query}
      initialResults={initialResults}
      initialError={initialError}
    />
  );
}
