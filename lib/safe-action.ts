import { createSafeActionClient } from "next-safe-action";

/**
 * Shared `next-safe-action` client — the entry point for every Server Action
 * in the app. Extend it with middleware, metadata, or error handlers here as
 * the project grows.
 *
 * @see https://next-safe-action.dev/docs/quick-start
 */
export const actionClient = createSafeActionClient();
