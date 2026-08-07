import { ScanDetailClient } from "@/components/scans/ScanDetailClient";

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <ScanDetailClient scanId={id} />
    </div>
  );
}
