import { Suspense } from "react";
import { ExploreClient } from "@/components/explore/ExploreClient";

export default function ExplorePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Suspense fallback={<p className="text-muted">Loading explore…</p>}>
        <ExploreClient />
      </Suspense>
    </div>
  );
}
