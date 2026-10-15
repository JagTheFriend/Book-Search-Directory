"use client";

import Image from "next/image";
import { useState } from "react";
import type { Book } from "@/lib/openlibrary";
import { BookOpenIcon } from "./icons";

/**
 * LQIP placeholder shown behind covers while they load, so cards never look
 * blank. A 20×20 diagonal zinc-200→zinc-400 gradient PNG (292 bytes),
 * generated with sharp and matching the no-cover placeholder below —
 * next/image scales + blurs it and fades the real cover in on top.
 */
const COVER_BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAdVBMVEXDw8m7u8LKys/Ly9HGxsy9vcTIyM3BwcfExMq/v8W6usDNzdK4uL+2tr3Pz9S0tLzR0dXS0tezs7rU1NmxsbjW1tqvr7etrbXY2NysrLTZ2d2qqrLb29/d3eGoqLDf3+Kmpq/g4OSlpa3i4uWjo6zk5Oehoaqi/zaTAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAVUlEQVQY023IWQJCAAAA0YksoSiyRUi6/xG7wLzPx7FvyzyN/bO+V7c8DOJzCnIJchfkIuROyGXIFchdkSuReyDXINci1yE3IPdC7o3citwHuS9yvz9/SBRBMxirGgAAAABJRU5ErkJggg==";

/**
 * A single result card: cover image, title, authors, and release year.
 *
 * Handles real-world gaps gracefully — covers render a blurred placeholder
 * plus an animated shimmer skeleton until the real image loads, books
 * without a cover get a styled placeholder, and covers that 404 at runtime
 * fall back to the same placeholder instead of a broken image.
 */
export function BookCard({ book }: { book: Book }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);

  /**
   * `onError` never fires when the cover 404s before React hydration attaches
   * its listener (a server-rendered `<img>` starts loading immediately), so
   * also check at attach time whether the image is already broken — or
   * already *loaded* (from cache), in which case the `load` event has come
   * and gone too and the skeleton must be dismissed right away.
   */
  const handleImageRef = (img: HTMLImageElement | null) => {
    if (!img?.complete) return;
    if (img.naturalWidth === 0) {
      setCoverFailed(true);
    } else {
      setCoverLoaded(true);
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
            placeholder="blur"
            blurDataURL={COVER_BLUR_DATA_URL}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setCoverFailed(true)}
            onLoad={() => setCoverLoaded(true)}
            ref={handleImageRef}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700">
            <BookOpenIcon className="h-12 w-12 text-zinc-400 dark:text-zinc-500" />
          </div>
        )}

        {/* Skeleton shimmer while the cover downloads: the sweep animates over
            the blurred LQIP preview (transparent base via `.over-image`), so
            the card signals "loading" without ever going blank. Rendered on
            the server too (coverLoaded starts false), dismissed by onLoad or
            the attach-time check for already-loaded images. */}
        {book.coverUrl !== null && !coverFailed && !coverLoaded && (
          <div className="absolute inset-0" aria-hidden="true">
            <div
              data-testid="cover-skeleton"
              className="skeleton over-image h-full w-full"
            />
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
