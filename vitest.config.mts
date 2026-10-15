import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest setup follows the official Next.js guide:
// https://nextjs.org/docs/app/guides/testing/vitest
export default defineConfig({
  plugins: [react()],
  // Native Vite 8 replacement for the vite-tsconfig-paths plugin (`@/*` alias).
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    // Unit/component tests only — Playwright owns the *.spec.ts E2E suite.
    include: ["**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // Component tests assert against debounced timing; keep runs deterministic.
    testTimeout: 10_000,
  },
});
