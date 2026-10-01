"use client";

import { App, Button } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryButton({ id }: { id: string }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="small"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/candidates/${id}/retry`, { method: "POST" });
        if (res.ok) {
          await fetch("/api/sync", { method: "POST" });
          message.success("Scored");
        } else {
          message.error((await res.json().catch(() => ({}))).error ?? "Retry failed");
        }
        setBusy(false);
        router.refresh();
      }}
    >
      Retry
    </Button>
  );
}
