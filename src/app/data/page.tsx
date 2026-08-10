import { DataManager } from "@/components/data/DataManager";

export default function DataPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="ui-field-label">Local data</p>
        <h1 className="ui-page-title mt-2 text-3xl">Price database</h1>
        <p className="ui-helper mt-2">
          All OHLCV data is stored in your browser. Nothing is saved on a server.
        </p>
      </div>
      <DataManager />
    </div>
  );
}
