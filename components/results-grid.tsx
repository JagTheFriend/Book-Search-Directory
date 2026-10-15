import type { Book } from "@/lib/openlibrary";
import { BookCard } from "./book-card";

/**
 * Single source of truth for the responsive CSS Grid layout:
 * 2 columns on phones → 3 on tablets → 4 on laptops → 5 on wide screens.
 * 24 results per page fills every breakpoint evenly.
 */
export const RESULTS_GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function ResultsGrid({ books }: { books: Book[] }) {
  return (
    <div className={RESULTS_GRID_CLASS}>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
