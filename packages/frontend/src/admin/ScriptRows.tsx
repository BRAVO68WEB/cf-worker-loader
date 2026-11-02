import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { bindFailure, isAbortError } from "./apiErrorMessage";
import { missingLabels, type SwitchEntry } from "./switchReason";
import { scriptIdOf, scriptRowState, type BindingSide } from "./scriptRowState";

interface Step {
  id: string;
  type: string;
  scriptId?: unknown;
}

interface ReadyScript {
  status: "ready";
  name: string;
  platform: BindingSide | null;
  cloudflare: BindingSide | null;
}

type ScriptLoad = { status: "loading" } | { status: "error" } | ReadyScript;

export function ScriptRows({
  steps,
  onGate,
}: {
  steps: Step[];
  onGate: (gate: { pending: boolean; labels: string[] }) => void;
}) {
  const onGateRef = useRef(onGate);
  onGateRef.current = onGate;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const life = useRef<AbortController | null>(null);
  const [loads, setLoads] = useState<Map<string, ScriptLoad>>(new Map());
  const [busy, setBusy] = useState<Map<string, "loader" | "worker">>(new Map());
  const [notice, setNotice] = useState<Map<string, string>>(new Map());
  const signature = steps.map((step) => `${step.id}:${scriptIdOf(step.scriptId)}`).join("|");

  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    return () => life.current?.abort();
  }, []);

  useEffect(() => {
    const currentSteps = stepsRef.current;
    const ids = [...new Set(currentSteps.map((step) => scriptIdOf(step.scriptId)).filter((id) => id.length > 0))];
    if (ids.length === 0) return;
    const controller = new AbortController();
    setLoads((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        if (!next.has(id)) next.set(id, { status: "loading" });
      }
      return next;
    });
    for (const id of ids) {
      api
        .get<{ name?: string; bindings?: { platform?: BindingSide | null; cloudflare?: BindingSide | null } }>(
          `/scripts/${id}`,
          controller.signal
        )
        .then((doc) => {
          if (controller.signal.aborted) return;
          setLoads((prev) => {
            const next = new Map(prev);
            next.set(id, {
              status: "ready",
              name: typeof doc.name === "string" ? doc.name : "",
              platform: doc.bindings?.platform ?? null,
              cloudflare: doc.bindings?.cloudflare ?? null,
            });
            return next;
          });
        })
        .catch((err: unknown) => {
          if (isAbortError(err) || controller.signal.aborted) return;
          setLoads((prev) => {
            const next = new Map(prev);
            next.set(id, { status: "error" });
            return next;
          });
        });
    }
    return () => controller.abort();
  }, [signature]);

  useEffect(() => {
    const currentSteps = stepsRef.current;
    const ids = [...new Set(currentSteps.map((step) => scriptIdOf(step.scriptId)).filter((id) => id.length > 0))];
    const pending = ids.some((id) => loads.get(id)?.status !== "ready" && loads.get(id)?.status !== "error");
    const entries: SwitchEntry[] = currentSteps.map((step) => {
      const scriptId = scriptIdOf(step.scriptId);
      if (!scriptId) return { label: step.id, blocked: true };
      const load = loads.get(scriptId);
      if (!load || load.status === "loading") return { label: step.id, blocked: true };
      if (load.status === "error") return { label: step.id, blocked: true };
      const label = load.name.trim() ? load.name : step.id;
      return { label, blocked: load.cloudflare?.status !== "active" };
    });
    onGateRef.current({ pending, labels: pending ? [] : missingLabels(entries) });
  }, [loads, signature]);

  async function bind(scriptId: string, mode: "loader" | "worker") {
    const signal = life.current?.signal;
    if (!signal || signal.aborted) return;
    setBusy((prev) => new Map(prev).set(scriptId, mode));
    setNotice((prev) => {
      const next = new Map(prev);
      next.delete(scriptId);
      return next;
    });
    try {
      const body = await api.post<{ binding?: BindingSide }>(`/scripts/${scriptId}/bindings/cloudflare`, { mode }, signal);
      if (signal.aborted) return;
      setLoads((prev) => {
        const current = prev.get(scriptId);
        if (!current || current.status !== "ready") return prev;
        const next = new Map(prev);
        next.set(scriptId, { ...current, cloudflare: body.binding ?? null });
        return next;
      });
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return;
      const parsed = bindFailure(err);
      setNotice((prev) => new Map(prev).set(scriptId, parsed.text));
      if (parsed.binding) {
        setLoads((prev) => {
          const current = prev.get(scriptId);
          if (!current || current.status !== "ready") return prev;
          const next = new Map(prev);
          next.set(scriptId, { ...current, cloudflare: parsed.binding });
          return next;
        });
      }
    } finally {
      if (signal.aborted) return;
      setBusy((prev) => {
        const next = new Map(prev);
        next.delete(scriptId);
        return next;
      });
    }
  }

  if (steps.length === 0) return <p>This form has no script steps.</p>;

  return (
    <div>
      {steps.map((step) => {
        const scriptId = scriptIdOf(step.scriptId);
        if (!scriptId) {
          return (
            <div key={step.id} className="script-row">
              <div className="mono">{step.id}</div>
              <p>This step has no script.</p>
            </div>
          );
        }
        const load = loads.get(scriptId);
        if (!load || load.status === "loading") {
          return (
            <div key={step.id} className="script-row">
              <div className="mono">{step.id}</div>
            </div>
          );
        }
        if (load.status === "error") {
          return (
            <div key={step.id} className="script-row">
              <div className="mono">{step.id}</div>
              <p>Could not load this script.</p>
            </div>
          );
        }
        const state = scriptRowState({ scriptId, platform: load.platform, cloudflare: load.cloudflare });
        const mode = busy.get(scriptId);
        const rowNotice = notice.get(scriptId);
        const name = load.name.trim() ? load.name : step.id;
        return (
          <div key={step.id} className="script-row">
            <Link to={`/scripts/${scriptId}`}>{name}</Link>
            {mode ? <p>Binding {mode}…</p> : null}
            {state.kind === "unpublished" ? <p>Publish the script before binding Cloudflare</p> : null}
            {state.kind === "unbound" ? (
              <div>
                {rowNotice ? <p className="row-error">{rowNotice}</p> : null}
                {!rowNotice && state.error ? <p className="row-error">{state.error}</p> : null}
                <button type="button" className="bind-coral" disabled={Boolean(mode)} onClick={() => void bind(scriptId, "loader")}>
                  Bind loader
                </button>
                <button type="button" className="bind-coral" disabled={Boolean(mode)} onClick={() => void bind(scriptId, "worker")}>
                  Bind worker
                </button>
              </div>
            ) : null}
            {state.kind === "bound" ? (
              <div>
                <p>Cloudflare {state.mode}</p>
                {state.target ? <p className="muted">{state.target}</p> : null}
                {rowNotice ? <p className="row-error">{rowNotice}</p> : null}
                <button type="button" className="bind-quiet" disabled={Boolean(mode)} onClick={() => void bind(scriptId, state.other)}>
                  Bind {state.other}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
