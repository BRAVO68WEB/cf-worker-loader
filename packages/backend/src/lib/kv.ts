/**
 * Cloudflare KV REST API: list keys and get values (for session restore).
 */

const BASE = "https://api.cloudflare.com/client/v4";

export async function getSessionStore(
  sessionId: string,
  env: { CLOUDFLARE_ACCOUNT_ID: string; CLOUDFLARE_API_TOKEN: string; KV_NAMESPACE_ID: string }
): Promise<Record<string, unknown>> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_NAMESPACE_ID } = env;
  if (!KV_NAMESPACE_ID) return {};
  const prefix = `ORCR_SESSION::${sessionId}::`;
  const listUrl = `${BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?prefix=${encodeURIComponent(prefix)}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
  });
  if (!listRes.ok) return {};
  const listData = (await listRes.json()) as { result?: { name: string }[] };
  const keys = listData.result ?? [];
  const store: Record<string, unknown> = {};
  for (const k of keys) {
    const keyName = k.name;
    const valueUrl = `${BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(keyName)}`;
    const valueRes = await fetch(valueUrl, {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    });
    if (valueRes.ok) {
      const shortKey = keyName.slice(prefix.length);
      const text = await valueRes.text();
      try {
        store[shortKey] = JSON.parse(text);
      } catch {
        store[shortKey] = text;
      }
    }
  }
  return store;
}
