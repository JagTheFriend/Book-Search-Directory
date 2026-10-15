import { expect, type Page } from "@playwright/test";

/** 1×1 transparent PNG, served in place of `next/image` optimizer requests. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Mock API base (matches the PORT used in playwright.config.ts). */
export const MOCK_API = "http://localhost:3200";

/**
 * Cover images load through `next/image` (a browser request we can intercept).
 * Stubbing them keeps the suite offline and instant.
 */
export async function stubCoverImages(page: Page): Promise<void> {
  await page.route("**/_next/image**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
  );
}

/** Resets mock-API state (e.g. the "fail once" counter) for deterministic retries. */
export async function resetMockApi(): Promise<void> {
  const response = await fetch(`${MOCK_API}/reset`);
  expect(response.ok).toBe(true);
}
