/**
 * Orchestrator Worker that uses the Cloudflare Worker Loader binding to run user scripts
 * in dynamic isolates at runtime. One deployed Worker can execute any script by id/source
 * without deploying a separate Worker per script.
 *
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/
 *
 * Dynamic Worker Loading is in closed beta on Cloudflare; it works in local dev (Wrangler/workerd).
 * For production you must sign up: https://forms.gle/MoeDxE9wNiqdf8ri9
 */

import { DYNAMIC_WRAPPER_MAIN } from "./dynamic-wrapper.js";

async function hashSource(source: string): Promise<string> {
  const buf = new TextEncoder().encode(source);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return hex;
}

type LoaderEnv = {
  LOADER: {
    get(id: string, getCode: () => Promise<WorkerCode>): WorkerStub;
  };
  KV?: KVNamespace;
  [key: string]: unknown;
};

interface WorkerCode {
  compatibilityDate: string;
  mainModule: string;
  modules: Record<string, string>;
  env?: Record<string, unknown>;
  globalOutbound?: unknown;
}

interface WorkerStub {
  getEntrypoint(): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
}

export default {
  async fetch(request: Request, env: LoaderEnv, _ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const scriptId = String(body.scriptId ?? body.script_id ?? "");
    const scriptSource = body.scriptSource ?? body.script_source ?? "";
    if (!scriptId || !scriptSource) {
      return new Response(
        JSON.stringify({ error: "script_id and script_source (or scriptId, scriptSource) required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const userCode = typeof scriptSource === "string" ? scriptSource : String(scriptSource);
    const sourceHashHex = await hashSource(userCode);
    const loaderId = `${scriptId}::${sourceHashHex}`;

    const loader = env.LOADER;
    if (!loader) {
      return new Response(
        JSON.stringify({ error: "worker_loader_not_configured", message: "LOADER binding required. Use wrangler.loader.toml and Worker Loader beta." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const userModule = userCode.trim().startsWith("export ")
      ? userCode
      : `const __exports = {}; const exports = __exports; const module = { exports: __exports };\n${userCode}\n;\nexport const execute = __exports.execute;`;

    const worker = loader.get(loaderId, async (): Promise<WorkerCode> => ({
      compatibilityDate: "2024-11-01",
      mainModule: "index.js",
      modules: {
        "index.js": DYNAMIC_WRAPPER_MAIN,
        "user.js": userModule,
      },
      env: env.KV ? { KV: env.KV } : {},
      globalOutbound: null,
    }));

    const executionPayload = { ...body };
    delete executionPayload.scriptId;
    delete executionPayload.script_id;
    delete executionPayload.scriptSource;
    delete executionPayload.script_source;

    const innerRequest = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(executionPayload),
    });

    return worker.getEntrypoint().fetch(innerRequest);
  },
};
