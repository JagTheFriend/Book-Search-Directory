import { AlertTriangleIcon, SearchIcon } from "./icons";

type SuggestionChipsProps = {
  onPickQuery: (query: string) => void;
};

/** Curated one-click searches so the idle/empty states are never a dead end. */
export const SEARCH_SUGGESTIONS = [
  { label: "Harry Potter", query: "harry potter" },
  { label: "Dune", query: "dune frank herbert" },
  { label: "The Hobbit", query: "the hobbit" },
  { label: "Clean Code", query: "clean code" },
  { label: "Pride and Prejudice", query: "pride and prejudice" },
] as const;

function SuggestionChips({ onPickQuery }: SuggestionChipsProps) {
  return (
    <ul className="flex flex-wrap justify-center gap-2">
      {SEARCH_SUGGESTIONS.map((suggestion) => (
        <li key={suggestion.query}>
          <button
            type="button"
            onClick={() => onPickQuery(suggestion.query)}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:text-zinc-50"
          >
            {suggestion.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

const STATE_CARD_CLASS =
  "flex flex-col items-center gap-5 rounded-2xl border border-dashed px-6 py-14 text-center";

/** No query yet — invites the user to search or pick a suggestion. */
export function IdleState({ onPickQuery }: SuggestionChipsProps) {
  return (
    <div
      className={`${STATE_CARD_CLASS} border-zinc-300 bg-white/60 dark:border-zinc-700 dark:bg-zinc-900/60`}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"
        aria-hidden="true"
      >
        <SearchIcon className="h-6 w-6 text-zinc-500" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Find your next read
        </h2>
        <p className="mx-auto max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Search millions of books by title, author, or topic — or try one of
          these:
        </p>
      </div>
      <SuggestionChips onPickQuery={onPickQuery} />
    </div>
  );
}

/** Query returned zero matches — the graceful “No results found” state. */
export function EmptyState({
  query,
  onPickQuery,
}: SuggestionChipsProps & { query: string }) {
  return (
    <output
      className={`${STATE_CARD_CLASS} border-zinc-300 bg-white/60 dark:border-zinc-700 dark:bg-zinc-900/60`}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"
        aria-hidden="true"
      >
        <SearchIcon className="h-6 w-6 text-zinc-500" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          No results found
        </h2>
        <p className="mx-auto max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
          We couldn’t find any books for{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            “{query}”
          </span>
          . Check the spelling, or try a broader term.
        </p>
      </div>
      <SuggestionChips onPickQuery={onPickQuery} />
    </output>
  );
}

/** The request failed — shows the server’s friendly message plus a retry. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/60 dark:bg-red-950/40"
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/60"
        aria-hidden="true"
      >
        <AlertTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
          Search failed
        </h2>
        <p className="max-w-md text-sm text-red-700 dark:text-red-300">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Try again
      </button>
    </div>
  );
}

/** Announced result count above the grid. */
export function ResultsMeta({
  query,
  count,
  totalFound,
}: {
  query: string;
  count: number;
  totalFound: number;
}) {
  const label =
    totalFound > count
      ? `Showing ${count} of ${totalFound.toLocaleString("en-US")} results for “${query}”`
      : `${count} result${count === 1 ? "" : "s"} for “${query}”`;

  return (
    <output className="block text-sm text-zinc-500 dark:text-zinc-400">
      {label}
    </output>
  );
}
