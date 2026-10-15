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
