"use server";

import { returnServerError } from "next-safe-action";
import { SEARCH_FAILED_MESSAGE } from "@/lib/messages";
import { type SearchResult, searchBooks } from "@/lib/openlibrary";
import { actionClient } from "@/lib/safe-action";
import { searchQuerySchema } from "@/lib/schemas";

/**
 * Validates the query with Zod, then runs the Open Library search
 * **server-side** (no CORS exposure, no API key, response normalized before
 * crossing the Server → Client boundary).
 */
export const searchBooksAction = actionClient
  .inputSchema(searchQuerySchema)
  .action(async ({ parsedInput: { q } }): Promise<SearchResult> => {
    try {
      return await searchBooks(q);
    } catch (error) {
      console.error("[search-booksAction] upstream failure:", error);
      // `returnServerError` is an *expected* error: it's returned to the
      // client as `result.serverError`, bypassing the default masking handler.
      returnServerError(SEARCH_FAILED_MESSAGE);
    }
  });
