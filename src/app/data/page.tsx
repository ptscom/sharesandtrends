import { PageContainer } from "@/components/layout/PageContainer";
import { UpstoxDataManager } from "@/components/upstox/UpstoxDataManager";

export default function DataPage() {
  return (
    <PageContainer>
      <p className="ui-eyebrow">Upstox NSE</p>
      <h1 className="ui-page-title mt-2">Market data</h1>
      <p className="ui-helper mt-2">
        Current-day snapshots and end-of-day history from Upstox, stored in
        IndexedDB and used by Explore and Backtest. Re-downloading a date range
        only overwrites those dates; older bars are kept.
      </p>
      <div className="mt-8">
        <UpstoxDataManager />
      </div>
    </PageContainer>
  );
}
