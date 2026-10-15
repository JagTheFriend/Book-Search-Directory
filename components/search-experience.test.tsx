import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_FAILED_MESSAGE } from "@/lib/messages";
import { type Book, DEFAULT_QUERY } from "@/lib/openlibrary";
import { SearchExperience } from "./search-experience";

// vi.mock factories are hoisted above imports, so anything they reference must
// be created via vi.hoisted.
const captured = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));
const searchBooksMock = vi.hoisted(() => vi.fn());
const connectionMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("next/server", () => ({ connection: connectionMock }));

// Keep the real module for DEFAULT_QUERY, replace only the network call.
vi.mock("@/lib/openlibrary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openlibrary")>()),
  searchBooks: searchBooksMock,
}));

// The child is a large client component with its own tests; here we only need
// the props the server component hands it.
vi.mock("./search-directory", () => ({
  SearchDirectory: (props: Record<string, unknown>) => {
    captured.props = props;
    return null;
  },
}));

const book: Book = {
  id: "/works/X",
  title: "X",
  authors: [],
  firstPublishYear: null,
  coverUrl: null,
};

/** Awaits the server component and renders its tree so the child captures props. */
async function runExperience(
  params: Record<string, string | string[] | undefined>,
): Promise<Record<string, unknown>> {
  const tree = await SearchExperience({
    searchParams: Promise.resolve(params),
  });
  render(tree);

  if (captured.props === null) {
    throw new Error("SearchDirectory child was never rendered");
  }
  return captured.props;
}

beforeEach(() => {
  captured.props = null;
  searchBooksMock.mockReset();
  connectionMock.mockReset();
  // The component logs fetch failures; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SearchExperience param parsing", () => {
  it("falls back to DEFAULT_QUERY when no q param is present", async () => {
    searchBooksMock.mockResolvedValue({ books: [book], totalFound: 1 });

    const props = await runExperience({});

    expect(searchBooksMock).toHaveBeenCalledTimes(1);
    expect(searchBooksMock).toHaveBeenCalledWith(DEFAULT_QUERY);
    expect(props.initialQuery).toBe(DEFAULT_QUERY);
    expect(props.initialResults).toEqual({ books: [book], totalFound: 1 });
    expect(props.initialError).toBeNull();
  });

  it("fetches with the provided q and passes results through", async () => {
    searchBooksMock.mockResolvedValue({ books: [book], totalFound: 1 });

    const props = await runExperience({ q: "dune" });

    expect(searchBooksMock).toHaveBeenCalledTimes(1);
    expect(searchBooksMock).toHaveBeenCalledWith("dune");
    expect(props.initialQuery).toBe("dune");
    expect(props.initialResults).toEqual({ books: [book], totalFound: 1 });
    expect(props.initialError).toBeNull();
  });

  it("renders the idle state for an empty q without fetching", async () => {
    const props = await runExperience({ q: "" });

    expect(searchBooksMock).not.toHaveBeenCalled();
    expect(connectionMock).not.toHaveBeenCalled();
    expect(props.initialQuery).toBe("");
    expect(props.initialResults).toBeNull();
    expect(props.initialError).toBeNull();
  });

  it("treats a whitespace-only q as idle without fetching", async () => {
    const props = await runExperience({ q: "   " });

    expect(searchBooksMock).not.toHaveBeenCalled();
    expect(connectionMock).not.toHaveBeenCalled();
    expect(props.initialQuery).toBe("");
    expect(props.initialResults).toBeNull();
    expect(props.initialError).toBeNull();
  });

  it("uses the first value when q arrives as an array", async () => {
    searchBooksMock.mockResolvedValue({ books: [book], totalFound: 1 });

    const props = await runExperience({ q: ["first", "second"] });

    expect(searchBooksMock).toHaveBeenCalledWith("first");
    expect(props.initialQuery).toBe("first");
    expect(props.initialResults).toEqual({ books: [book], totalFound: 1 });
  });

  it("rejects an oversized query before any network call", async () => {
    // Longer than the shared MAX_QUERY_LENGTH limit (120).
    const props = await runExperience({ q: "a".repeat(1000) });

    expect(searchBooksMock).not.toHaveBeenCalled();
    expect(connectionMock).not.toHaveBeenCalled();
    expect(props.initialError).toBe(SEARCH_FAILED_MESSAGE);
    expect(props.initialResults).toBeNull();
  });

  it("renders the shell with an error state when the fetch rejects", async () => {
    searchBooksMock.mockRejectedValue(new TypeError("fetch failed"));

    const props = await runExperience({ q: "dune" });

    expect(captured.props).not.toBeNull();
    expect(props.initialQuery).toBe("dune");
    expect(props.initialResults).toBeNull();
    expect(props.initialError).toBe(SEARCH_FAILED_MESSAGE);
  });

  it("passes empty results through for a successful search with no matches", async () => {
    searchBooksMock.mockResolvedValue({ books: [], totalFound: 0 });

    const props = await runExperience({ q: DEFAULT_QUERY });

    expect(searchBooksMock).toHaveBeenCalledWith(DEFAULT_QUERY);
    expect(props.initialResults).toEqual({ books: [], totalFound: 0 });
    expect(props.initialError).toBeNull();
  });
});
