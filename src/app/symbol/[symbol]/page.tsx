import { SymbolDetail } from "@/components/symbol/SymbolDetail";

export default async function SymbolPage({
  params,
  searchParams,
}: PageProps<"/symbol/[symbol]">) {
  const { symbol } = await params;
  const query = await searchParams;
  const scanId = typeof query.scanId === "string" ? query.scanId : undefined;
  const patternId =
    typeof query.patternId === "string" ? query.patternId : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <SymbolDetail
        symbol={symbol.toUpperCase()}
        scanId={scanId}
        patternId={patternId}
      />
    </div>
  );
}
