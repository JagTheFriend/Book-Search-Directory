/**
 * Deterministic stand-in for the Open Library Search API, used by the
 * Playwright suite so end-to-end tests never depend on the public API.
 *
 * Special queries (verified against the exact, trimmed query string):
 * - "failme"      → 500 on the first attempt, then succeeds (retry test)
 * - "slow query"  → ~1.8s delay (loading-skeleton test)
 * - anything with "zzz" → zero results (no-results test)
 * - anything else → 12 deterministic books (grid / responsive tests)
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT ?? 3200);

const attempts = new Map();

function book(index) {
  return {
    key: `/works/MOCK${index}W`,
    title: `Mock Book ${index}`,
    subtitle: `Volume ${index}`,
    author_name: ["Mock Author", "Second Author"],
    first_publish_year: 2000 + index,
    cover_i: 1000 + index,
  };
}

const DEFAULT_DOCS = Array.from({ length: 12 }, (_, index) => book(index + 1));

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/reset") {
    attempts.clear();
    return send(res, 200, { ok: true });
  }

  const q = (url.searchParams.get("q") ?? "").trim();

  if (q === "failme") {
    const seen = (attempts.get(q) ?? 0) + 1;
    attempts.set(q, seen);
    if (seen === 1) {
      return send(res, 500, { message: "mock upstream failure" });
    }
    return send(res, 200, { numFound: 1, docs: [book(99)] });
  }

  if (q === "slow query") {
    return setTimeout(
      () => send(res, 200, { numFound: 3, docs: DEFAULT_DOCS.slice(0, 3) }),
      1800,
    );
  }

  if (q.includes("zzz")) {
    return send(res, 200, { numFound: 0, docs: [] });
  }

  return send(res, 200, { numFound: DEFAULT_DOCS.length, docs: DEFAULT_DOCS });
}).listen(PORT, () => {
  console.log(`mock Open Library API listening on http://localhost:${PORT}`);
});
