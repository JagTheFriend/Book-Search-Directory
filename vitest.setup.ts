import { createElement, type ImgHTMLAttributes } from "react";
import { vi } from "vitest";

/**
 * `next/image` expects the Next.js runtime (image optimizer config), so unit
 * tests render a plain `<img>` that keeps the props the UI relies on
 * (`src`, `alt`, `className`, `onError`) and drops optimizer-only ones.
 */
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const {
      fill: _fill,
      sizes: _sizes,
      priority: _priority,
      preload: _preload,
      placeholder: _placeholder,
      blurDataURL: _blurDataURL,
      loader: _loader,
      unoptimized: _unoptimized,
      ...imgProps
    } = props;
    return createElement(
      "img",
      imgProps as ImgHTMLAttributes<HTMLImageElement>,
    );
  },
}));

/**
 * `next/cache` requires the Next.js server runtime (framework async context),
 * but `lib/openlibrary.ts` calls `cacheLife()` inside its `"use cache"`
 * search function — so tests replace it with no-op spies.
 */
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

/**
 * jsdom never actually loads images, so by default every `<img>` reports
 * `complete === true` and `naturalWidth === 0` — which the book card's
 * attach-time check would treat as a permanently broken cover. Pretend images
 * load successfully so only explicit `error` events trigger the fallback;
 * individual tests can spy these getters to simulate a pre-hydration 404.
 */
Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
  configurable: true,
  get: () => 100,
});
Object.defineProperty(HTMLImageElement.prototype, "complete", {
  configurable: true,
  get: () => true,
});
