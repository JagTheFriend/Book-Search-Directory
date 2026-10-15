"use client";

import { useAction } from "next-safe-action/hooks";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { searchBooksAction } from "@/app/actions/search-books";
import { useDebounce } from "@/hooks/use-debounce";
import {
  SEARCH_FALLBACK_MESSAGE,
  SEARCH_INVALID_MESSAGE,
} from "@/lib/messages";
import type { Book } from "@/lib/openlibrary";
import { ClearIcon, SearchIcon } from "./icons";
import { ResultsGrid } from "./results-grid";
import {
  EmptyState,
  ErrorState,
  IdleState,
  ResultsMeta,
} from "./search-states";
import { SearchingLine, SkeletonGrid } from "./skeletons";

/** How long the user must pause typing before the server action fires. */
const DEBOUNCE_MS = 400;

type Props = {
  /** Query the server already fetched (mirrors `?q=`), or `""` for the idle state. */
  initialQuery: string;
  /** SSR results, or `null` when there was nothing to show / the SSR fetch failed. */
  initialResults: { books: Book[]; totalFound: number } | null;
  /** Friendly message when the initial server-side fetch failed. */
  initialError: string | null;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "success"; query: string; books: Book[]; totalFound: number }
  | { status: "error"; query: string; message: string };

function initialState({
  initialQuery,
  initialResults,
  initialError,
}: Props): SearchState {
  if (initialError !== null) {
    return { status: "error", query: initialQuery, message: initialError };
  }
  if (initialResults !== null) {
    return { status: "success", query: initialQuery, ...initialResults };
  }
  return { status: "idle" };
}

/**
 * Keeps the address bar in sync so reloads/shares reproduce the same SSR
 * results, without triggering a router navigation (and therefore no refetch).
 * Native `replaceState` is officially integrated with the Next.js router.
 */
function syncUrl(query: string) {
  const url = query === "" ? "/?q=" : `/?q=${encodeURIComponent(query)}`;
  window.history.replaceState(null, "", url);
}

export function SearchDirectory(props: Props) {
  const [query, setQuery] = useState(props.initialQuery);
  const [state, setState] = useState<SearchState>(() => initialState(props));
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const { executeAsync } = useAction(searchBooksAction);

  /** Query whose request/result currently owns the UI — stale responses are dropped. */
  const activeQueryRef = useRef(props.initialQuery);

  const runSearch = useCallback(
    async (rawQuery: string, options?: { force?: boolean }) => {
      const target = rawQuery.trim();

      if (target === "") {
        activeQueryRef.current = "";
        setState({ status: "idle" });
        syncUrl("");
        return;
      }

      // Skip if this query already owns the UI (unless explicitly forced, e.g. retry).
      if (target === activeQueryRef.current && options?.force !== true) return;

      activeQueryRef.current = target;
      setState({ status: "loading", query: target });

      try {
        const result = await executeAsync({ q: target });

        // A newer search started while this one was in flight — ignore it.
        if (activeQueryRef.current !== target) return;

        if (result.data !== undefined) {
          setState({
            status: "success",
            query: target,
            books: result.data.books,
            totalFound: result.data.totalFound,
          });
          syncUrl(target);
        } else if (result.validationErrors !== undefined) {
          setState({
            status: "error",
            query: target,
            message: SEARCH_INVALID_MESSAGE,
          });
        } else {
          setState({
            status: "error",
            query: target,
            message: result.serverError ?? SEARCH_FALLBACK_MESSAGE,
          });
        }
      } catch (error) {
        if (activeQueryRef.current !== target) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : SEARCH_FALLBACK_MESSAGE;
        setState({ status: "error", query: target, message });
      }
    },
    [executeAsync],
  );

  // Search whenever the debounced input changes (fires once per pause, not per keystroke).
  useEffect(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query, { force: true });
  };

  const handleClear = () => {
    setQuery("");
    void runSearch("");
  };

  const handlePickQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    void runSearch(nextQuery, { force: true });
  };

  const handleRetry = () => {
    void runSearch(state.status === "error" ? state.query : query, {
      force: true,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
          Book Search Directory
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 sm:text-base">
          Search millions of books by title, author, or topic — powered by the
          free{" "}
          <a
            href="https://openlibrary.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Open Library
          </a>{" "}
          API. No key required.
        </p>
      </header>

      <search className="block">
        <form onSubmit={handleSubmit} className="relative">
          <label htmlFor="book-search" className="sr-only">
            Search books by title, author, or topic
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-zinc-400" />
          <input
            id="book-search"
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, author, or topic…"
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-14 w-full rounded-xl border border-zinc-300 bg-white pr-12 pl-12 text-base text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 sm:pr-36 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/20"
          />

          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            {query !== "" && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <ClearIcon className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="hidden rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-zinc-400 dark:focus-visible:ring-offset-zinc-900"
            >
              Search
            </button>
          </div>
        </form>
      </search>

      {/* One announced region per state (role="status" / role="alert" on each state). */}
      <section
        className="flex flex-col gap-6"
        aria-busy={state.status === "loading"}
      >
        {state.status === "idle" && <IdleState onPickQuery={handlePickQuery} />}

        {state.status === "loading" && (
          <>
            <SearchingLine query={state.query} />
            <SkeletonGrid count={10} />
          </>
        )}

        {state.status === "error" && (
          <ErrorState message={state.message} onRetry={handleRetry} />
        )}

        {state.status === "success" && state.books.length === 0 && (
          <EmptyState query={state.query} onPickQuery={handlePickQuery} />
        )}

        {state.status === "success" && state.books.length > 0 && (
          <>
            <ResultsMeta
              query={state.query}
              count={state.books.length}
              totalFound={state.totalFound}
            />
            <ResultsGrid books={state.books} />
          </>
        )}
      </section>
    </div>
  );
}
