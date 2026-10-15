import { expect, test } from "@playwright/test";
import { stubCoverImages } from "./helpers";

/**
 * Responsiveness matrix for the CSS Grid layout:
 * 2 columns on phones → 3 on tablets → 4 on laptops → 5 on wide screens,
 * with no horizontal overflow at any size.
 */
const VIEWPORTS = [
  { name: "small phone", width: 320, height: 640, columns: 2 },
  { name: "phone", width: 390, height: 844, columns: 2 },
  { name: "tablet", width: 768, height: 1024, columns: 3 },
  { name: "laptop", width: 1100, height: 800, columns: 4 },
  { name: "desktop", width: 1440, height: 900, columns: 5 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`layout holds at ${viewport.name} (${viewport.width}px)`, async ({
    page,
  }) => {
    await stubCoverImages(page);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");

    await expect(page.locator("article")).toHaveCount(12, { timeout: 15_000 });
    // Streaming SSR briefly holds resolved content in a hidden container until
    // React's reveal script runs — wait for a real paint before measuring.
    await expect(page.locator("article").first()).toBeVisible();

    // 1. No horizontal overflow — the classic "broken on mobile" failure.
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth + 1);

    // 2. The CSS Grid hits the expected column count for this breakpoint.
    // Measured from real card geometry (first-row card count) — more honest
    // than parsing `gridTemplateColumns`, which Chromium sometimes returns
    // unexpanded (`repeat(3, minmax(0, 1fr))`).
    const columnCount = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("article"))
        .map((card) => card.getBoundingClientRect())
        .filter((box) => box.width > 0);
      if (cards.length === 0) return 0;
      const firstRowY = cards[0].top;
      return cards.filter((box) => Math.abs(box.top - firstRowY) < 2).length;
    });
    expect(columnCount).toBe(viewport.columns);

    // 3. The search input always fits inside the viewport.
    const inputBox = await page.getByRole("searchbox").boundingBox();
    if (!inputBox) throw new Error("search input is not rendered");
    expect(inputBox.width).toBeLessThanOrEqual(viewport.width);
  });
}
