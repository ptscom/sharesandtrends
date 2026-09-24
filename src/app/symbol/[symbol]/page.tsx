import { PageContainer } from "@/components/layout/PageContainer";
import { ExplorationSymbolDetail } from "@/components/symbol/ExplorationSymbolDetail";
import { SymbolDetail } from "@/components/symbol/SymbolDetail";

export default async function SymbolPage({
  params,
  searchParams,
}: PageProps<"/symbol/[symbol]">) {
  const { symbol } = await params;
  const query = await searchParams;
  const explorationScanId =
    typeof query.explorationScanId === "string"
      ? query.explorationScanId
      : undefined;

  if (explorationScanId) {
    return (
      <PageContainer>
        <ExplorationSymbolDetail
          symbol={symbol.toUpperCase()}
          explorationScanId={explorationScanId}
        />
      </PageContainer>
    );
  }

  const scanId = typeof query.scanId === "string" ? query.scanId : undefined;
  const patternId =
    typeof query.patternId === "string" ? query.patternId : undefined;

  return (
    <PageContainer>
      <SymbolDetail
        symbol={symbol.toUpperCase()}
        scanId={scanId}
        patternId={patternId}
      />
    </PageContainer>
  );
}
