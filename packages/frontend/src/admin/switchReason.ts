export interface SwitchEntry {
  label: string;
  blocked: boolean;
}

export function missingLabels(entries: SwitchEntry[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const entry of entries) {
    if (!entry.blocked) continue;
    if (seen.has(entry.label)) continue;
    seen.add(entry.label);
    labels.push(entry.label);
  }
  return labels;
}

function joinLabels(labels: string[]): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function switchReason(labels: string[]): string | null {
  if (labels.length === 0) return null;
  const verb = labels.length === 1 ? "has" : "have";
  return `Switch off. ${joinLabels(labels)} ${verb} no Cloudflare binding.`;
}
