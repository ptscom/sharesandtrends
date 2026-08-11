import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { ExploreSkeleton } from "@/components/explore/ExploreSkeleton";

export default function ExplorePage() {
  return (
    <PageContainer>
      <Suspense fallback={<ExploreSkeleton />}>
        <ExploreClient />
      </Suspense>
    </PageContainer>
  );
}
