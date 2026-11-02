import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { apiErrorMessage, isAbortError } from "./apiErrorMessage";
import { truncateJson } from "./desk";

interface SessionItem {
  sessionId: string;
  updatedAt: string | null;
  keys: string[];
}

interface StoreDetail {
  sessionId: string;
  updatedAt: string | null;
  store: Record<string, unknown>;
}

interface LiveDetail {
  sessionId: string;
  readable: boolean;
  store: Record<string, unknown> | null;
}

type Detail =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "unreadable" }
  | { kind: "error"; text: string }
  | { kind: "keys"; sessionId: string; entries: { key: string; text: string; truncated: boolean }[] };

function fromStore(sessionId: string, store: unknown): Detail {
  if (!store || typeof store !== "object" || Array.isArray(store)) return { kind: "empty" };
  const record = store as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return { kind: "empty" };
  return {
    kind: "keys",
    sessionId,
    entries: keys.map((key) => ({ key, ...truncateJson(record[key]) })),
  };
}

function DetailView({ detail }: { detail: Detail }) {
  if (detail.kind === "loading") return <p>Loading…</p>;
  if (detail.kind === "empty") return <p>No keys.</p>;
  if (detail.kind === "unreadable") return <p>This session is not readable. Cloudflare KV is not configured.</p>;
  if (detail.kind === "error") return <p>{detail.text}</p>;
  if (detail.kind !== "keys") return null;
  return (
    <div>
      {detail.entries.map((entry) => (
        <div key={entry.key}>
          <div className="mono">{entry.key}</div>
          <pre className="store-value">{entry.text}</pre>
          {entry.truncated ? <p className="muted">Truncated.</p> : null}
        </div>
      ))}
    </div>
  );
}

export function SessionPanel({ formId, slug }: { formId: string; slug: string }) {
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [typedId, setTypedId] = useState("");
  const [detail, setDetail] = useState<Detail>({ kind: "idle" });
  const openLife = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    openLife.current = controller;
    return () => openLife.current?.abort();
  }, []);

  function nextOpenSignal(): AbortSignal {
    openLife.current?.abort();
    const controller = new AbortController();
    openLife.current = controller;
    return controller.signal;
  }

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ sessions: SessionItem[] }>(`/forms/${formId}/sessions`, controller.signal)
      .then((body) => {
        if (controller.signal.aborted) return;
        setSessions(body.sessions);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setListError(apiErrorMessage(err, "Could not load sessions."));
      });
    return () => controller.abort();
  }, [formId]);

  async function openListed(sessionId: string) {
    const signal = nextOpenSignal();
    setOpenId(sessionId);
    setDetail({ kind: "loading" });
    try {
      const body = await api.get<StoreDetail>(`/forms/${formId}/sessions/${encodeURIComponent(sessionId)}`, signal);
      if (signal.aborted) return;
      setDetail(fromStore(sessionId, body.store));
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return;
      setDetail({ kind: "error", text: apiErrorMessage(err, "Could not open that session.") });
    }
  }

  async function openLive(event: { preventDefault: () => void }) {
    event.preventDefault();
    const sessionId = typedId.trim();
    if (!sessionId) return;
    const signal = nextOpenSignal();
    setOpenId(sessionId);
    setDetail({ kind: "loading" });
    try {
      const body = await api.get<LiveDetail>(
        `/forms/${encodeURIComponent(slug)}/session/${encodeURIComponent(sessionId)}`,
        signal
      );
      if (signal.aborted) return;
      if (body.readable === false) {
        setDetail({ kind: "unreadable" });
        return;
      }
      setDetail(fromStore(sessionId, body.store));
    } catch (err) {
      if (isAbortError(err) || signal.aborted) return;
      setDetail({ kind: "error", text: apiErrorMessage(err, "Could not open that session.") });
    }
  }

  return (
    <section>
      <h2>Platform sessions</h2>
      <p className="muted">Listed rows are platform stores.</p>
      {listError ? <p>{listError}</p> : null}
      {sessions && sessions.length === 0 ? <p>No platform sessions yet.</p> : null}
      {sessions && sessions.length === 20 ? <p className="muted">Showing the 20 latest platform sessions.</p> : null}
      {sessions?.map((session) => (
        <button
          key={session.sessionId}
          type="button"
          className={openId === session.sessionId ? "session-row is-open" : "session-row"}
          onClick={() => void openListed(session.sessionId)}
        >
          <span className="mono">{session.sessionId}</span>
          {session.updatedAt ? <span className="muted"> {new Date(session.updatedAt).toLocaleString()}</span> : null}
          {session.keys.length > 0 ? <span className="muted"> {session.keys.join(", ")}</span> : null}
        </button>
      ))}
      <DetailView detail={detail} />
      <form className="session-open" onSubmit={(event) => void openLive(event)}>
        <label>
          Open a session id on the live runtime
          <input value={typedId} onChange={(event) => setTypedId(event.target.value)} />
        </label>
        <button type="submit">Open</button>
      </form>
    </section>
  );
}
