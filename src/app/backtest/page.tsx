import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { BacktestClient } from "@/components/backtest/BacktestClient";

export default function BacktestPage() {
  return (
    <PageContainer>
      <Suspense fallback={<p className="text-body">Loading…</p>}>
        <BacktestClient />
      </Suspense>
    </PageContainer>
  );
}
