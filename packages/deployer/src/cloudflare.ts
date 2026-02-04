/**
 * Cloudflare API: upload Worker script and (optional) create route.
 * Uses multipart/form-data for module workers.
 */

export interface CloudflareEnv {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  KV_NAMESPACE_ID?: string;
}

export interface UploadResult {
  success: boolean;
  workerUrl?: string;
  error?: string;
}

/**
 * Upload a Worker script (ESM) to Cloudflare.
 * Script becomes available at https://<scriptName>.<subdomain>.workers.dev
 */
export async function uploadWorker(
  scriptName: string,
  scriptContent: string,
  env: CloudflareEnv
): Promise<UploadResult> {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_NAMESPACE_ID } = env;
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return { success: false, error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN" };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`;

  const metadata: Record<string, unknown> = {
    main_module: "worker.js",
    compatibility_date: "2024-11-01",
  };
  if (KV_NAMESPACE_ID) {
    metadata.bindings = [
      { type: "kv_namespace", name: "KV", namespace_id: KV_NAMESPACE_ID },
    ];
  }

  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  form.append("worker.js", new Blob([scriptContent], { type: "application/javascript+module" }), "worker.js");

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Cloudflare API ${res.status}: ${text}` };
  }

  const data = (await res.json()) as { success?: boolean; errors?: unknown[] };
  if (!data.success && data.errors?.length) {
    return { success: false, error: String(data.errors[0]) };
  }

  return {
    success: true,
    workerUrl: `https://${scriptName}.workers.dev`,
  };
}
