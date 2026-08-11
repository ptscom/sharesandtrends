import { PageContainer } from "@/components/layout/PageContainer";
import { DataManager } from "@/components/data/DataManager";

export default function DataPage() {
  return (
    <PageContainer>
      <p className="ui-eyebrow">Local data</p>
      <h1 className="ui-page-title mt-2">Price database</h1>
      <p className="ui-helper mt-2">
        All OHLCV data is stored in your browser. Nothing is saved on a server.
      </p>
      <div className="mt-8">
        <DataManager />
      </div>
    </PageContainer>
  );
}
