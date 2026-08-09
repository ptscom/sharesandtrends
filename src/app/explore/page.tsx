import { Suspense } from "react";
import { ExploreClient } from "@/components/explore/ExploreClient";

export default function ExplorePage() {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-muted">Loading explore…</p>}>
      <ExploreClient />
    </Suspense>
  );
}
