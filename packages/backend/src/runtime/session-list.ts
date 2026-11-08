const CAP = 20;

export interface SessionListDoc {
  sessionId: string;
  updatedAt?: Date | string | null;
  data?: unknown;
}

export interface SessionListItem {
  sessionId: string;
  updatedAt: string | null;
  keys: string[];
}

export function plainStore(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return {};
  return { ...(data as Record<string, unknown>) };
}

function timestamp(value: Date | string | null | undefined): { iso: string | null; sort: number } {
  if (value == null || value === "") return { iso: null, sort: Number.NEGATIVE_INFINITY };
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return { iso: null, sort: Number.NEGATIVE_INFINITY };
  return { iso: date.toISOString(), sort: time };
}

export function presentSessionList(docs: SessionListDoc[]): { sessions: SessionListItem[] } {
  const ranked = [...docs].sort((a, b) => timestamp(b.updatedAt).sort - timestamp(a.updatedAt).sort);
  return {
    sessions: ranked.slice(0, CAP).map((doc) => ({
      sessionId: doc.sessionId,
      updatedAt: timestamp(doc.updatedAt).iso,
      keys: Object.keys(plainStore(doc.data)),
    })),
  };
}

export function presentSessionDetail(doc: SessionListDoc): {
  sessionId: string;
  updatedAt: string | null;
  store: Record<string, unknown>;
} {
  return {
    sessionId: doc.sessionId,
    updatedAt: timestamp(doc.updatedAt).iso,
    store: plainStore(doc.data),
  };
}
