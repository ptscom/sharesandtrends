import { PageContainer } from "@/components/layout/PageContainer";
import { ScanDetailClient } from "@/components/scans/ScanDetailClient";

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageContainer>
      <ScanDetailClient scanId={id} />
    </PageContainer>
  );
}
