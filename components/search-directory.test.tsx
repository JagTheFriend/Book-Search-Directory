import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SEARCH_FAILED_MESSAGE, SEARCH_FALLBACK_MESSAGE } from "@/lib/messages";
import type { Book } from "@/lib/openlibrary";
import { SearchDirectory } from "./search-directory";

const { executeAsyncMock } = vi.hoisted(() => ({
  executeAsyncMock: vi.fn(),
}));

// The component only needs `executeAsync` from the hook; the action module
// itself is replaced with a placeholder so no Server Action machinery loads.
vi.mock("next-safe-action/hooks", () => ({
  useAction: () => ({
    executeAsync: executeAsyncMock,
    execute: vi.fn(),
    result: {},
    status: "idle",
    isIdle: true,
    isExecuting: false,
    isTransitioning: false,
    isPending: false,
    hasSucceeded: false,
    hasErrored: false,
    hasNavigated: false,
    reset: vi.fn(),
  }),
}));

vi.mock("@/app/actions/search-books", () => ({
  searchBooksAction: Symbol("searchBooksAction"),
}));

function makeBook(index: number): Book {
  return {
    id: `/works/OL${index}W`,
    title: `Book ${index}`,
    authors: ["Author"],
    firstPublishYear: 2000 + index,
    coverUrl: null,
  };
}

function successResult(count = 2) {
  return {
    data: {
      books: Array.from({ length: count }, (_, index) => makeBook(index + 1)),
      totalFound: 42,
    },
  };
}

function typeQuery(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/** `getByRole` returns `HTMLElement`; the search input is always an `<input>`. */
function getSearchInput(): HTMLInputElement {
  return screen.getByRole("searchbox") as HTMLInputElement;
}

describe("SearchDirectory", () => {
  it("renders server-provided results without refetching", async () => {
    render(
      <SearchDirectory
        initialQuery="dune"
        initialResults={{ books: [makeBook(1)], totalFound: 99 }}
        initialError={null}
      />,
    );

    expect(screen.getByText("Book 1")).toBeTruthy();
    expect(screen.getByText("Showing 1 of 99 results for “dune”")).toBeTruthy();

    // Wait past the debounce window and confirm no duplicate request fired.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(executeAsyncMock).not.toHaveBeenCalled();
  });

  it("debounces typing into a single server action call", async () => {
    executeAsyncMock.mockResolvedValue(successResult());
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    const input = getSearchInput();
    expect(executeAsyncMock).not.toHaveBeenCalled();

    typeQuery(input, "h");
    typeQuery(input, "ha");
    typeQuery(input, "har");
    expect(executeAsyncMock).not.toHaveBeenCalled(); // not before the debounce

    await waitFor(() => expect(executeAsyncMock).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(executeAsyncMock).toHaveBeenCalledWith({ q: "har" });
    await waitFor(() => expect(screen.getByText("Book 1")).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it("shows the loading skeleton while a search is in flight", async () => {
    let resolveSearch!: (value: unknown) => void;
    executeAsyncMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "dune");

    await waitFor(() => expect(executeAsyncMock).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(screen.getByText("Searching for “dune”…")).toBeTruthy();
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0);

    await act(async () => {
      resolveSearch(successResult());
    });
    expect(screen.queryByText(/Searching for/)).toBeNull();
    expect(screen.getByText("Book 1")).toBeTruthy();
  });

  it("renders the graceful “No results found” state", async () => {
    executeAsyncMock.mockResolvedValue({ data: { books: [], totalFound: 0 } });
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "zzz-no-such-book");

    await waitFor(
      () => expect(screen.getByText("No results found")).toBeTruthy(),
      {
        timeout: 2000,
      },
    );
    expect(screen.getByText(/zzz-no-such-book/)).toBeTruthy();
  });

  it("surfaces upstream failures and recovers via retry", async () => {
    // Raw error details stay in the logs — the UI shows the friendly fallback.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    executeAsyncMock
      .mockRejectedValueOnce(new Error("Raw upstream failure details."))
      .mockResolvedValueOnce(successResult(1));
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "dune");

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), {
      timeout: 2000,
    });
    expect(screen.getByText("Search failed")).toBeTruthy();
    expect(screen.getByText(SEARCH_FALLBACK_MESSAGE)).toBeTruthy();
    expect(screen.queryByText("Raw upstream failure details.")).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[search-directory] search failed:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("Book 1")).toBeTruthy(), {
      timeout: 2000,
    });
    expect(executeAsyncMock).toHaveBeenCalledTimes(2);
  });

  it("maps action serverError results to the error state", async () => {
    executeAsyncMock.mockResolvedValue({
      serverError: SEARCH_FAILED_MESSAGE,
    });
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "dune");

    await waitFor(
      () => expect(screen.getByText(SEARCH_FAILED_MESSAGE)).toBeTruthy(),
      { timeout: 2000 },
    );
  });

  it("renders the error state passed down from the server render", () => {
    render(
      <SearchDirectory
        initialQuery="dune"
        initialResults={null}
        initialError="Search failed upstream."
      />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Search failed upstream.")).toBeTruthy();
  });

  it("syncs the URL after a successful search", async () => {
    executeAsyncMock.mockResolvedValue(successResult());
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "harry potter");

    await waitFor(
      () =>
        expect(replaceSpy).toHaveBeenCalledWith(null, "", "/?q=harry%20potter"),
      { timeout: 2000 },
    );
  });

  it("clearing the query returns to the idle state and resets the URL", async () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    render(
      <SearchDirectory
        initialQuery="dune"
        initialResults={{ books: [makeBook(1)], totalFound: 1 }}
        initialError={null}
      />,
    );

    // Clearing is done from the keyboard (there is no clear button): deleting
    // every character flows through the debounce into the empty-query idle path.
    typeQuery(getSearchInput(), "");

    await waitFor(
      () => expect(screen.getByText("Find your next read")).toBeTruthy(),
      { timeout: 2000 },
    );
    await waitFor(
      () => expect(replaceSpy).toHaveBeenCalledWith(null, "", "/?q="),
      { timeout: 2000 },
    );
  });

  it("submits immediately on Enter without waiting for the debounce", async () => {
    executeAsyncMock.mockResolvedValue(successResult());
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "dune");
    fireEvent.submit(getSearchInput().closest("form") as HTMLFormElement);

    expect(executeAsyncMock).toHaveBeenCalledWith({ q: "dune" });
  });

  it("picking a suggestion chip searches immediately", async () => {
    executeAsyncMock.mockResolvedValue(successResult());
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dune" }));

    expect(executeAsyncMock).toHaveBeenCalledWith({ q: "dune frank herbert" });
    await waitFor(() => expect(screen.getByText("Book 1")).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it("ignores a duplicate suggestion chip click while the first search is in flight", async () => {
    let resolveSearch!: (value: unknown) => void;
    executeAsyncMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    const chip = screen.getByRole("button", { name: "Dune" });
    fireEvent.click(chip);
    fireEvent.click(chip);

    expect(executeAsyncMock).toHaveBeenCalledTimes(1);
    expect(executeAsyncMock).toHaveBeenCalledWith({ q: "dune frank herbert" });

    await act(async () => {
      resolveSearch(successResult());
    });
    expect(screen.getByText("Book 1")).toBeTruthy();
  });

  it("ignores a duplicate Enter submit while the first search is in flight", async () => {
    let resolveSearch!: (value: unknown) => void;
    executeAsyncMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "dune");
    const form = getSearchInput().closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(executeAsyncMock).toHaveBeenCalledTimes(1);
    expect(executeAsyncMock).toHaveBeenCalledWith({ q: "dune" });

    await act(async () => {
      resolveSearch(successResult());
    });
    expect(screen.getByText("Book 1")).toBeTruthy();
  });

  it("announces status changes through one persistent polite live region", async () => {
    let resolveSearch!: (value: unknown) => void;
    executeAsyncMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");

    typeQuery(getSearchInput(), "dune");

    await waitFor(() => expect(status.textContent).toBe("Searching…"), {
      timeout: 2000,
    });

    await act(async () => {
      resolveSearch(successResult());
    });
    // successResult reports totalFound: 42.
    expect(status.textContent).toBe("42 results");
  });

  it("retries the current input value instead of the stale errored query", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    executeAsyncMock
      .mockRejectedValueOnce(new Error("Raw upstream failure details."))
      .mockResolvedValueOnce(successResult());
    render(
      <SearchDirectory
        initialQuery=""
        initialResults={null}
        initialError={null}
      />,
    );

    typeQuery(getSearchInput(), "old query");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), {
      timeout: 2000,
    });

    // Not yet debounced — retry must still search what the input says now.
    typeQuery(getSearchInput(), "new query");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(
      () => expect(executeAsyncMock).toHaveBeenCalledWith({ q: "new query" }),
      { timeout: 2000 },
    );
    consoleSpy.mockRestore();
  });
});
