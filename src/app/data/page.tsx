import { PageContainer } from "@/components/layout/PageContainer";
import { UpstoxDataManager } from "@/components/upstox/UpstoxDataManager";

export default function DataPage() {
  return (
    <PageContainer>
      <p className="ui-eyebrow">Upstox NSE</p>
      <h1 className="ui-page-title mt-2">Market data</h1>
      <p className="ui-helper mt-2">
        Current-day snapshots and end-of-day history from Upstox. EOD data is
        stored in your browser IndexedDB. EOD downloads are mirrored into the
        same price database Explore and Backtest read. API calls run through
        server routes; access tokens are never written to logs or persisted on
        the server.
      </p>
      <div className="mt-8">
        <UpstoxDataManager />
      </div>
    </PageContainer>
  );
}
