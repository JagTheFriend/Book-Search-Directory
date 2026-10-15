/**
 * User-facing messages shared across the Server → Client boundary.
 *
 * Kept in a plain module (not a `"use server"` file) because Server Action
 * files may only export async functions.
 */

/** Upstream search failure — phrased as an empty result, not a technical error. */
export const SEARCH_FAILED_MESSAGE = "Nothing was found.";

export const SEARCH_INVALID_MESSAGE =
  "That search wasn't valid — try a shorter, simpler query.";

/**
 * Generic fallback for client-side search failures — raw error details stay
 * in the console/server logs and are never shown to the user.
 */
export const SEARCH_FALLBACK_MESSAGE =
  "Something went wrong while searching. Please try again.";
