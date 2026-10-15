"use client";

import Image from "next/image";
import { useState } from "react";
import type { Book } from "@/lib/openlibrary";
import { BookOpenIcon } from "./icons";

/**
 * A single result card: cover image, title, authors, and release year.
 *
 * Handles real-world gaps gracefully — books without a cover get a styled
 * placeholder, and covers that 404 at runtime fall back to the same
 * placeholder instead of a broken image.
 */
export function BookCard({ book }: { book: Book }) {
  const [coverFailed, setCoverFailed] = useState(false);

  /**
   * `onError` never fires when the cover 404s before React hydration attaches
   * its listener (a server-rendered `<img>` starts loading immediately), so
   * also check at attach time whether the image is already broken.
   */
  const handleImageRef = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) {
      setCoverFailed(true);
    }
  };

  const authorLabel =
    book.authors.length === 0
      ? "Unknown author"
      : book.authors.length <= 2
        ? book.authors.join(", ")
        : `${book.authors.slice(0, 2).join(", ")} +${book.authors.length - 2}`;

  return (
    <article className="group flex h-full flex-col">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
        {book.coverUrl !== null && !coverFailed ? (
          <Image
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            fill
            sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 45vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setCoverFailed(true)}
            ref={handleImageRef}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700">
            <BookOpenIcon className="h-12 w-12 text-zinc-400 dark:text-zinc-500" />
          </div>
        )}

        {book.firstPublishYear !== null && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {book.firstPublishYear}
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100 sm:text-base">
        {book.title}
      </h3>
      <p className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
        {authorLabel}
      </p>
      {book.firstPublishYear === null && (
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
          Year unknown
        </p>
      )}
    </article>
  );
}
