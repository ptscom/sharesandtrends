import { Suspense } from "react";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { ExploreSkeleton } from "@/components/explore/ExploreSkeleton";

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreClient />
      </Suspense>
    </div>
  );
}
