import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookCard } from "./book-card";

const baseBook = {
  id: "/works/OL1W",
  title: "Dune",
  authors: ["Frank Herbert"],
  firstPublishYear: 1965 as number | null,
  coverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg" as string | null,
};

describe("BookCard", () => {
  it("renders title, author, release year, and cover image", () => {
    render(<BookCard book={baseBook} />);

    expect(screen.getByRole("heading", { name: "Dune" })).toBeTruthy();
    expect(screen.getByText("Frank Herbert")).toBeTruthy();
    expect(screen.getByText("1965")).toBeTruthy();

    const cover = screen.getByAltText("Cover of Dune");
    expect(cover.getAttribute("src")).toBe(baseBook.coverUrl);
  });

  it("renders a placeholder instead of a broken image when there is no cover", () => {
    render(<BookCard book={{ ...baseBook, coverUrl: null }} />);

    expect(screen.queryByAltText("Cover of Dune")).toBeNull();
    expect(screen.getByRole("heading", { name: "Dune" })).toBeTruthy();
  });

  it("swaps to the placeholder when the cover fails to load at runtime", () => {
    render(<BookCard book={baseBook} />);

    fireEvent.error(screen.getByAltText("Cover of Dune"));

    expect(screen.queryByAltText("Cover of Dune")).toBeNull();
  });

  it("swaps to the placeholder when the cover 404s before hydration", () => {
    // Simulate an image that finished loading before React attached its error
    // listener (so onError never fired) and came back broken.
    const naturalWidthSpy = vi
      .spyOn(HTMLImageElement.prototype, "naturalWidth", "get")
      .mockReturnValue(0);
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(true);

    try {
      render(<BookCard book={baseBook} />);

      expect(screen.queryByAltText("Cover of Dune")).toBeNull();
      expect(screen.getByRole("heading", { name: "Dune" })).toBeTruthy();
    } finally {
      naturalWidthSpy.mockRestore();
      completeSpy.mockRestore();
    }
  });

  it("shows a shimmer skeleton while the cover is still loading, then removes it", () => {
    // Simulate an image that has not finished loading yet (jsdom's default
    // mock reports every image as complete).
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, "complete", "get")
      .mockReturnValue(false);

    try {
      render(<BookCard book={baseBook} />);

      expect(screen.getByTestId("cover-skeleton")).toBeTruthy();

      fireEvent.load(screen.getByAltText("Cover of Dune"));

      expect(screen.queryByTestId("cover-skeleton")).toBeNull();
    } finally {
      completeSpy.mockRestore();
    }
  });

  it("shows no skeleton when the cover was already loaded before hydration", () => {
    // Default jsdom mock: complete + naturalWidth > 0 — the attach-time check
    // must dismiss the skeleton so a cached cover never stays covered.
    render(<BookCard book={baseBook} />);

    expect(screen.queryByTestId("cover-skeleton")).toBeNull();
  });

  it("shows “Year unknown” when Open Library has no publication year", () => {
    render(<BookCard book={{ ...baseBook, firstPublishYear: null }} />);

    expect(screen.getByText("Year unknown")).toBeTruthy();
    expect(screen.queryByText("1965")).toBeNull();
  });

  it("truncates long author lists", () => {
    render(<BookCard book={{ ...baseBook, authors: ["A", "B", "C", "D"] }} />);

    expect(screen.getByText("A, B +2")).toBeTruthy();
  });

  it("falls back to “Unknown author” when the list is empty", () => {
    render(<BookCard book={{ ...baseBook, authors: [] }} />);

    expect(screen.getByText("Unknown author")).toBeTruthy();
  });
});
