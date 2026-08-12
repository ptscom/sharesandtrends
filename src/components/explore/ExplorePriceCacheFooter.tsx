"use client";

import { useEffect, useState } from "react";
import { getPriceCacheStatus } from "@/lib/storage/prices";

interface ExplorePriceCacheFooterProps {
  refreshKey?: number | string | null;
}

export function ExplorePriceCacheFooter({
  refreshKey,
}: ExplorePriceCacheFooterProps) {
  const [status, setStatus] = useState(getPriceCacheStatus);

  useEffect(() => {
    setStatus(getPriceCacheStatus());
  }, [refreshKey]);

  useEffect(() => {
    const refresh = () => setStatus(getPriceCacheStatus());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  if (status.cachedSymbolCount === 0) {
    return (
      <p className="text-center text-xs text-muted">
        Price cache is empty. The first scan loads prices from browser storage
        into memory; later scans reuse the cache until you refresh the page or
        update data.
      </p>
    );
  }

  return (
    <p className="text-center text-xs text-muted">
      Price cache: {status.cachedSymbolCount.toLocaleString()} symbol
      {status.cachedSymbolCount === 1 ? "" : "s"} in memory
      {status.lastCachedAt ? (
        <>
          {" "}
          · last loaded{" "}
          <time dateTime={status.lastCachedAt} className="text-body">
            {formatCachedAt(status.lastCachedAt)}
          </time>
        </>
      ) : null}
    </p>
  );
}

function formatCachedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
