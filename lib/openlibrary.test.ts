import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSearchUrl,
  DEFAULT_QUERY,
  normalizeDoc,
  normalizeDocs,
  RESULTS_PER_QUERY,
  sanitizeQuery,
  searchBooks,
} from "./openlibrary";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSearchUrl", () => {
  it("targets the search endpoint with a limited field set and page size", () => {
    const url = new URL(buildSearchUrl("clean code"));

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://openlibrary.org/search.json",
    );
    expect(url.searchParams.get("q")).toBe("clean code");
    expect(url.searchParams.get("limit")).toBe(String(RESULTS_PER_QUERY));
    expect(url.searchParams.get("fields")).toBe(
      "key,title,subtitle,author_name,first_publish_year,cover_i",
    );
  });

  it("URL-encodes special characters", () => {
    expect(buildSearchUrl("tom & jerry")).toContain("q=tom+%26+jerry");
  });
});

describe("normalizeDoc", () => {
  it("maps a complete doc and derives the cover URL", () => {
    expect(
      normalizeDoc({
        key: "/works/OL1W",
        title: "Dune",
        subtitle: "Book One",
        author_name: ["Frank Herbert"],
        first_publish_year: 1965,
        cover_i: 123,
      }),
    ).toEqual({
      id: "/works/OL1W",
      title: "Dune: Book One",
      authors: ["Frank Herbert"],
      firstPublishYear: 1965,
      coverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
    });
  });

  it("tolerates docs missing optional fields", () => {
    expect(normalizeDoc({ key: "/works/OL2W", title: "Mystery" })).toEqual({
      id: "/works/OL2W",
      title: "Mystery",
      authors: [],
      firstPublishYear: null,
      coverUrl: null,
    });
  });

  it("drops docs without an id or title instead of crashing", () => {
    expect(normalizeDoc({ title: "No key" })).toBeNull();
    expect(normalizeDoc({ key: "/works/OL3W" })).toBeNull();
    expect(normalizeDoc({ key: " ", title: " " })).toBeNull();
  });
});

describe("normalizeDocs", () => {
  it("deduplicates repeated works and skips unusable docs", () => {
    const books = normalizeDocs([
      { key: "/works/A", title: "A" },
      { key: "/works/A", title: "A duplicate edition" },
      { title: "no id" },
      { key: "/works/B", title: "B" },
    ]);

    expect(books.map((book) => book.id)).toEqual(["/works/A", "/works/B"]);
  });

  it("handles an undefined doc list", () => {
    expect(normalizeDocs(undefined)).toEqual([]);
  });
});

describe("searchBooks", () => {
  it("fetches, normalizes, and reports the total match count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        numFound: 321,
        docs: [
          {
            key: "/works/A",
            title: "Dune",
            first_publish_year: 1965,
            cover_i: 7,
          },
          { key: "/works/B", title: "Children of Dune" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchBooks("  dune ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("q=dune");
    expect(result.totalFound).toBe(321);
    expect(result.books).toHaveLength(2);
    expect(result.books[0].coverUrl).toBe(
      "https://covers.openlibrary.org/b/id/7-L.jpg",
    );
    expect(result.books[1].coverUrl).toBeNull();
  });

  it("passes an AbortSignal so a hung upstream request cannot stall SSR", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ numFound: 0, docs: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchBooks("dune");

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("throws a status error on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    await expect(searchBooks("dune")).rejects.toThrow("status 429");
  });

  it("propagates network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    await expect(searchBooks("dune")).rejects.toThrow("fetch failed");
  });

  it("rejects when the API reports matches but no doc normalizes to a book", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ numFound: 5, docs: [{}] }),
      }),
    );

    await expect(searchBooks("dune")).rejects.toThrow(
      "Open Library returned no usable books",
    );
  });

  it("short-circuits blank queries without hitting the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchBooks("   ")).resolves.toEqual({
      books: [],
      totalFound: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("short-circuits operator-only queries without hitting the network (the API answers them with 422/500)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchBooks(": && -")).resolves.toEqual({
      books: [],
      totalFound: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes operator characters out of the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ numFound: 0, docs: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchBooks("star wars: a new hope");

    expect(fetchMock.mock.calls[0]?.[0]).toContain("q=star+wars+a+new+hope");
  });
});

describe("sanitizeQuery", () => {
  it("replaces Solr operator characters with spaces and collapses the gap", () => {
    expect(sanitizeQuery("star wars: a new hope")).toBe("star wars a new hope");
    expect(sanitizeQuery("harry-potter")).toBe("harry potter");
    expect(sanitizeQuery("1984: a dystopia?!")).toBe("1984 a dystopia");
    expect(sanitizeQuery(": && -")).toBe("");
  });

  it("keeps apostrophes and normal words intact", () => {
    expect(sanitizeQuery("it's")).toBe("it's");
    expect(sanitizeQuery("  The Hunger Games  ")).toBe("The Hunger Games");
  });
});

describe("DEFAULT_QUERY", () => {
  it("is a non-empty landing query so the grid SSRs on first paint", () => {
    expect(DEFAULT_QUERY.trim().length).toBeGreaterThan(0);
  });
});
