import { PageContainer } from "@/components/layout/PageContainer";
import { UpstoxDataManager } from "@/components/upstox/UpstoxDataManager";

export default function DataPage() {
  return (
    <PageContainer>
      <p className="ui-eyebrow">Upstox NSE</p>
      <h1 className="ui-page-title mt-2">Market data</h1>
      <p className="ui-helper mt-2">
        Current-day snapshots, EOD history, and intraday minute history from
        Upstox. EOD is stored in IndexedDB and merged into Explore/Backtest;
        intraday is stored separately for session-level analysis. Re-downloading
        a range only overwrites matching bars.
      </p>
      <div className="mt-8">
        <UpstoxDataManager />
      </div>
    </PageContainer>
  );
}
