import { SpinnerIcon } from "./icons";
import { RESULTS_GRID_CLASS } from "./results-grid";

/** Decorative shimmer placeholder shaped like a book card. */
function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="skeleton aspect-[2/3] w-full rounded-lg" />
      <div className="skeleton h-4 w-4/5 rounded" />
      <div className="skeleton h-3 w-3/5 rounded" />
    </div>
  );
}

/** Decorative grid of card skeletons (loading is announced by SearchDirectory’s live region). */
export function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className={RESULTS_GRID_CLASS} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: this static skeleton list never reorders or changes
        <BookCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Visible loading line shown while the server action runs (announced via SearchDirectory’s live region). */
export function SearchingLine({ query }: { query: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
      <SpinnerIcon className="h-4 w-4 animate-spin" />
      Searching for “{query}”…
    </p>
  );
}

/**
 * Full-page Suspense fallback streamed on the very first request (before the
 * server finishes fetching search results). Mirrors the real layout so the
 * page doesn’t jump when content arrives.
 */
export function PageSkeleton() {
  return (
    <output
      aria-busy="true"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading the book directory…</span>
      <div className="flex flex-col gap-3">
        <div className="skeleton h-9 w-72 max-w-full rounded-lg" />
        <div className="skeleton h-4 w-96 max-w-full rounded" />
      </div>
      <div className="skeleton h-14 w-full rounded-xl" />
      <div className="skeleton h-4 w-64 rounded" />
      <SkeletonGrid count={10} />
    </output>
  );
}
