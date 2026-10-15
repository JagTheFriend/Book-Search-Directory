import { z } from "zod";

/** Maximum query length — shared with the search input's `maxLength`. */
export const MAX_QUERY_LENGTH = 120;

/**
 * Input contract for book searches.
 *
 * Validation runs on the server *before* any network call happens, so
 * malformed or oversized queries never reach the Open Library API.
 */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Enter something to search for.")
    .max(
      MAX_QUERY_LENGTH,
      `That search is too long — keep it under ${MAX_QUERY_LENGTH} characters.`,
    ),
});

/** What the client sends (untrusted). */
export type SearchQueryInput = z.input<typeof searchQuerySchema>;

/** What the server receives after validation/normalization (trimmed). */
export type SearchQueryOutput = z.output<typeof searchQuerySchema>;
