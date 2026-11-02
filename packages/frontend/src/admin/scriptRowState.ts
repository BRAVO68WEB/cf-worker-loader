export interface BindingSide {
  status?: string;
  mode?: "loader" | "worker";
  target?: string;
  error?: string;
}

export type ScriptRowState =
  | { kind: "no-script" }
  | { kind: "unpublished" }
  | { kind: "unbound"; error?: string }
  | { kind: "bound"; mode: "loader" | "worker"; target?: string; other: "loader" | "worker" };

export function scriptIdOf(raw: unknown): string {
  if (raw && typeof raw === "object" && "_id" in raw) {
    const id = (raw as { _id: unknown })._id;
    return id == null ? "" : String(id);
  }
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  return String(raw);
}

export function scriptRowState(input: {
  scriptId: string;
  platform: { status?: string } | null;
  cloudflare: BindingSide | null;
}): ScriptRowState {
  if (!input.scriptId) return { kind: "no-script" };
  if (input.platform?.status !== "active") return { kind: "unpublished" };
  const cloudflare = input.cloudflare;
  if (cloudflare?.status === "active" && (cloudflare.mode === "loader" || cloudflare.mode === "worker")) {
    return {
      kind: "bound",
      mode: cloudflare.mode,
      target: cloudflare.target,
      other: cloudflare.mode === "loader" ? "worker" : "loader",
    };
  }
  return cloudflare?.error ? { kind: "unbound", error: cloudflare.error } : { kind: "unbound" };
}
