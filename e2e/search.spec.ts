import { expect, test } from "@playwright/test";
import { resetMockApi, stubCoverImages } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubCoverImages(page);
});

test.describe("SSR", () => {
  test("landing page streams the default query results server-side", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Book Search Directory" }),
    ).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue("harry potter");

    // All 12 results arrive in the initial server-rendered HTML.
    await expect(page.locator("article")).toHaveCount(12);
    await expect(page.getByText("12 results for “harry potter”")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mock Book 1: Volume 1" }),
    ).toBeVisible();
  });

  test("an explicit ?q= is respected; an empty ?q= shows the idle state", async ({
    page,
  }) => {
    await page.goto("/?q=some%20title");
    await expect(page.getByRole("searchbox")).toHaveValue("some title");
    await expect(page.locator("article")).toHaveCount(12);

    await page.goto("/?q=");
    await expect(page.getByText("Find your next read")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);
  });
});

test.describe("searching", () => {
  test("debounces typing into exactly one server action call", async ({
    page,
  }) => {
    let actionPosts = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().startsWith("http://localhost:3100")
      ) {
        actionPosts += 1;
      }
    });

    await page.goto("/");
    const input = page.getByRole("searchbox");

    await input.fill("h");
    await input.fill("ha");
    await input.fill("har");

    await expect(page.getByText("12 results for “har”")).toBeVisible({
      timeout: 5_000,
    });
    expect(actionPosts).toBe(1);
  });

  test("shows the loading skeleton while a slow search is in flight", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("slow query");

    await expect(page.getByText("Searching for “slow query”…")).toBeVisible({
      timeout: 2_000,
    });
    await expect(page.locator(".skeleton").first()).toBeVisible();

    await expect(page.locator("article")).toHaveCount(3, { timeout: 10_000 });
    await expect(page.getByText(/Searching for/)).toBeHidden();
  });

  test("renders the graceful “No results found” state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("zzz nothing matches this");

    await expect(page.getByText("No results found")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/zzz nothing matches this/)).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);

    // Not a dead end: suggestion chips are offered.
    await expect(
      page.getByRole("button", { name: "The Hobbit" }),
    ).toBeVisible();
  });

  test("shows an error state on upstream failure and recovers via retry", async ({
    page,
  }) => {
    await resetMockApi();
    await page.goto("/");
    await page.getByRole("searchbox").fill("failme");

    // Text-scoped assertions: Next.js ships its own empty `role="alert"`
    // (the route announcer), so `getByRole("alert")` alone would be ambiguous.
    await expect(page.getByText("Search failed")).toBeVisible({
      timeout: 5_000,
    });

    // Mock succeeds on the second attempt — the retry button must recover.
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(
      page.getByRole("heading", { name: /Mock Book 99/ }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Search failed")).toBeHidden();
  });

  test("clearing the input returns to the idle state", async ({ page }) => {
    await page.goto("/?q=some%20title");
    await page.getByRole("button", { name: "Clear search" }).click();

    await expect(page.getByText("Find your next read")).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveValue("");
  });

  test("picking a suggestion chip searches immediately", async ({ page }) => {
    await page.goto("/?q=");
    await page.getByRole("button", { name: "The Hobbit" }).click();

    await expect(page.locator("article")).toHaveCount(12, { timeout: 5_000 });
    await expect(page).toHaveURL(/\?q=the%20hobbit/);
  });
});

test.describe("URL state", () => {
  test("a successful search syncs the URL, and reloading reproduces it via SSR", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("the little prince");

    await expect(page).toHaveURL(/\?q=the%20little%20prince/);
    await expect(
      page.getByText("12 results for “the little prince”"),
    ).toBeVisible({
      timeout: 5_000,
    });

    await page.reload();
    await expect(page.getByRole("searchbox")).toHaveValue("the little prince");
    await expect(page.locator("article")).toHaveCount(12);
  });
});
