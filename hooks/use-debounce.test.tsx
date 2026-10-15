import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("dune", 400));

    expect(result.current).toBe("dune");
  });

  it("holds the old value until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 400),
      {
        initialProps: { value: "a" },
      },
    );

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("ab");
  });

  it("coalesces rapid changes into a single update (timer resets per keystroke)", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 400),
      {
        initialProps: { value: "h" },
      },
    );

    for (const value of ["ha", "har", "harr"]) {
      rerender({ value });
      act(() => vi.advanceTimersByTime(200));
    }
    expect(result.current).toBe("h");

    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe("harr");
  });

  it("supports custom delays", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      {
        initialProps: { value: "x" },
      },
    );

    rerender({ value: "y" });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("y");
  });
});
