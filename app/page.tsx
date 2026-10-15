import { Suspense } from "react";
import { SearchExperience } from "@/components/search-experience";
import { PageSkeleton } from "@/components/skeletons";

/**
 * With `cacheComponents` enabled, dynamic reads (like `searchParams`) must sit
 * inside a `<Suspense>` boundary — so the page component stays synchronous,
 * passes the *promise* down, and streams a skeleton until results are ready.
 */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SearchExperience searchParams={searchParams} />
    </Suspense>
  );
}
