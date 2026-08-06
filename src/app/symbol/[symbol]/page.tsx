import { SymbolDetail } from "@/components/symbol/SymbolDetail";

export default async function SymbolPage({
  params,
}: PageProps<"/symbol/[symbol]">) {
  const { symbol } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <SymbolDetail symbol={symbol.toUpperCase()} />
    </div>
  );
}
