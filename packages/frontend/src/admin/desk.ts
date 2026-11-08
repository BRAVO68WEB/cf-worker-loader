export function sortForms<T extends { name: string; _id: string }>(forms: T[]): T[] {
  return [...forms].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a._id.localeCompare(b._id);
  });
}

export function runtimeLabel(runtime: string | undefined): "Platform" | "Cloudflare" {
  return runtime === "cloudflare" ? "Cloudflare" : "Platform";
}

export function playerHref(slug: string, origin: string | undefined): string {
  const raw = origin && origin.trim() ? origin.trim() : "http://localhost:4000";
  const base = raw.replace(/\/+$/, "");
  return `${base}/fill/${encodeURIComponent(slug)}`;
}

export function scriptSteps<T extends { type: string }>(flow: T[] | undefined): T[] {
  return (flow ?? []).filter((step) => step.type === "script");
}

export function truncateJson(value: unknown): { text: string; truncated: boolean } {
  const rendered = JSON.stringify(value, null, 2) ?? "null";
  if (rendered.length <= 8000) return { text: rendered, truncated: false };
  return { text: rendered.slice(0, 8000), truncated: true };
}
