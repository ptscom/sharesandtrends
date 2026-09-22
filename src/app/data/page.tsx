import { PageContainer } from "@/components/layout/PageContainer";
import { DataManager } from "@/components/data/DataManager";
import { UpstoxDataManager } from "@/components/upstox/UpstoxDataManager";

export default function DataPage() {
  return (
    <PageContainer>
      <p className="ui-eyebrow">Market data</p>
      <h1 className="ui-page-title mt-2">Price database</h1>
      <p className="ui-helper mt-2">
        Primary NSE flow uses Upstox (current day and EOD). EOD is stored in
        IndexedDB and mirrored into the shared database Explore and Backtest use.
        Yahoo Finance tools remain below for backup and legacy downloads.
      </p>
      <div className="mt-8 space-y-16">
        <UpstoxDataManager />
        <section>
          <p className="ui-eyebrow">Legacy</p>
          <h2 className="ui-section-title mt-2">Yahoo Finance</h2>
          <p className="ui-helper mt-2">
            Browser-stored Yahoo OHLCV, inventory, backup/restore, and missing-data
            checks after update jobs.
          </p>
          <div className="mt-6">
            <DataManager />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
