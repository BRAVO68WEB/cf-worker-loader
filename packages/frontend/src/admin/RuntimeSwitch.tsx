import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { apiErrorMessage, isAbortError } from "./apiErrorMessage";
import { switchReason } from "./switchReason";

export function RuntimeSwitch({
  formId,
  runtime,
  pending,
  labels,
  onRuntime,
}: {
  formId: string;
  runtime: "platform" | "cloudflare" | undefined;
  pending: boolean;
  labels: string[];
  onRuntime: (runtime: "platform" | "cloudflare") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const life = useRef<AbortController | null>(null);
  const live = runtime === "cloudflare" ? "cloudflare" : "platform";
  const reason = pending ? null : switchReason(labels);
  const cloudflareEnabled = !pending && labels.length === 0;

  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    return () => life.current?.abort();
  }, []);

  async function choose(next: "platform" | "cloudflare") {
    if (next === live || busy) return;
    if (next === "cloudflare" && !cloudflareEnabled) return;
    const signal = life.current?.signal;
    if (!signal || signal.aborted) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = await api.patch<{ runtime: "platform" | "cloudflare" }>(
        `/forms/${formId}/runtime`,
        { runtime: next },
        signal
      );
      if (signal.aborted) return;
      onRuntime(body.runtime);
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return;
      setFailure(apiErrorMessage(err, "Could not switch."));
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <div>
      <div className="runtime-switch">
        <button type="button" className={live === "platform" ? "is-live" : undefined} disabled={busy} onClick={() => void choose("platform")}>
          Platform
        </button>
        <button
          type="button"
          className={live === "cloudflare" ? "is-live" : undefined}
          disabled={busy || !cloudflareEnabled}
          onClick={() => void choose("cloudflare")}
        >
          Cloudflare
        </button>
      </div>
      {reason ? <p className="switch-reason">{reason}</p> : null}
      {failure ? <p className="switch-error">{failure}</p> : null}
    </div>
  );
}
