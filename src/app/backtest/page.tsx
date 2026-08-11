import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { BacktestClient } from "@/components/backtest/BacktestClient";

export default function BacktestPage() {
  return (
    <PageContainer>
      <p className="ui-eyebrow">Research</p>
      <h1 className="ui-page-title mt-2">Backtest lab</h1>
      <p className="ui-helper mt-2">
        Test one or many strategies across up to 50 symbols. Sweep optimization
        parameters with custom ranges and steps — e.g. EMA 3×50 vs EMA 5×60.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-body">Loading…</p>}>
          <BacktestClient />
        </Suspense>
      </div>
    </PageContainer>
  );
}
