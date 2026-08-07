import { DataManager } from "@/components/data/DataManager";

export default function DataPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Local data</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Price database</h1>
        <p className="mt-2 text-muted">
          All OHLCV data is stored in your browser. Nothing is saved on a server.
        </p>
      </div>
      <DataManager />
    </div>
  );
}
