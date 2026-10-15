import { describe, expect, it } from "vitest";
import { searchQuerySchema } from "./schemas";

describe("searchQuerySchema", () => {
  it("trims valid input", () => {
    expect(searchQuerySchema.parse({ q: "  harry potter  " })).toEqual({
      q: "harry potter",
    });
  });

  it("accepts the maximum length (200 chars)", () => {
    expect(searchQuerySchema.safeParse({ q: "a".repeat(200) }).success).toBe(
      true,
    );
  });

  it("rejects empty or whitespace-only queries", () => {
    expect(searchQuerySchema.safeParse({ q: "" }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "   " }).success).toBe(false);
  });

  it("rejects oversized queries before they reach the API", () => {
    expect(searchQuerySchema.safeParse({ q: "a".repeat(201) }).success).toBe(
      false,
    );
  });

  it("rejects non-string input", () => {
    expect(searchQuerySchema.safeParse({ q: 42 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({}).success).toBe(false);
  });
});
