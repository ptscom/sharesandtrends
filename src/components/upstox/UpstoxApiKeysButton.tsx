"use client";

import { useCallback, useEffect, useState } from "react";
import { activeTokenCount } from "@/lib/upstox/client-tokens";
import { UpstoxApiKeysDialog } from "./UpstoxApiKeysDialog";

export function UpstoxApiKeysButton() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  const refreshCount = useCallback(() => {
    setCount(activeTokenCount());
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return (
    <>
      <button
        type="button"
        className="ui-btn-secondary mr-2 text-sm"
        onClick={() => {
          refreshCount();
          setOpen(true);
        }}
      >
        API Keys{count > 0 ? ` (${count})` : ""}
      </button>
      <UpstoxApiKeysDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(n) => setCount(n)}
      />
    </>
  );
}
