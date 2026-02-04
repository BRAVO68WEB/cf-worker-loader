/**
 * Deployer: bundle user script into worker template and deploy to Cloudflare.
 */

import type { FormScriptRef } from "@orcratration/shared";
import { randomUUID, createHash } from "node:crypto";
import { bundleScript } from "./bundle.js";
import { bundleWorker } from "./worker-bundle.js";
import { uploadWorker, type CloudflareEnv } from "./cloudflare.js";

export interface DeployFormOptions {
  formId: string;
  scripts: FormScriptRef[];
  scriptSources: Record<string, string>;
  routes?: { path: string }[];
}

export type DeployerEnv = Partial<CloudflareEnv>;

export interface DeployScriptResult {
  scriptId: string;
  workerName: string;
  workerUrl?: string;
  success: boolean;
  error?: string;
  sourceSha?: string;
}

export interface DeployFormResult {
  deploymentId: string;
  results: DeployScriptResult[];
}

/**
 * Deploy form + attached scripts to Cloudflare Workers.
 * Caller must pass scriptSources (scriptId -> source) and persist Deployment in Mongo.
 */
export async function deployForm(
  opts: DeployFormOptions,
  env?: DeployerEnv
): Promise<DeployFormResult> {
  const deploymentId = randomUUID();
  const results: DeployScriptResult[] = [];
  const cfEnv = env as CloudflareEnv | undefined;

  for (const ref of opts.scripts) {
    const scriptId = String(ref.scriptId);
    const source = opts.scriptSources[scriptId];
    const workerName = `orcratration-${scriptId.replace(/[^a-z0-9-_]/gi, "-").slice(0, 32)}`;

    if (!source) {
      results.push({ scriptId, workerName, success: false, error: "Missing script source" });
      continue;
    }

    try {
      const { code: userCode } = await bundleScript(source);
      const fullBundle = await bundleWorker(userCode);
      const sourceSha = hashSha(fullBundle);

      if (!cfEnv?.CLOUDFLARE_ACCOUNT_ID || !cfEnv?.CLOUDFLARE_API_TOKEN) {
        results.push({
          scriptId,
          workerName,
          success: false,
          error: "Cloudflare credentials not configured",
          sourceSha,
        });
        continue;
      }

      const upload = await uploadWorker(workerName, fullBundle, {
        CLOUDFLARE_ACCOUNT_ID: cfEnv.CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN: cfEnv.CLOUDFLARE_API_TOKEN,
        KV_NAMESPACE_ID: cfEnv.KV_NAMESPACE_ID,
      });

      results.push({
        scriptId,
        workerName,
        workerUrl: upload.workerUrl,
        success: upload.success,
        error: upload.error,
        sourceSha,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ scriptId, workerName, success: false, error: message });
    }
  }

  return { deploymentId, results };
}

/**
 * Deploy a single script (by source). Returns result for one worker.
 */
export async function deploySingleScript(
  scriptId: string,
  source: string,
  env?: DeployerEnv
): Promise<DeployScriptResult> {
  const workerName = `orcratration-${scriptId.replace(/[^a-z0-9-_]/gi, "-").slice(0, 32)}`;
  const cfEnv = env as CloudflareEnv | undefined;

  try {
    const { code: userCode } = await bundleScript(source);
    const fullBundle = await bundleWorker(userCode);
    const sourceSha = hashSha(fullBundle);

    if (!cfEnv?.CLOUDFLARE_ACCOUNT_ID || !cfEnv?.CLOUDFLARE_API_TOKEN) {
      return {
        scriptId,
        workerName,
        success: false,
        error: "Cloudflare credentials not configured",
        sourceSha,
      };
    }

    const upload = await uploadWorker(workerName, fullBundle, {
      CLOUDFLARE_ACCOUNT_ID: cfEnv.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: cfEnv.CLOUDFLARE_API_TOKEN,
      KV_NAMESPACE_ID: cfEnv.KV_NAMESPACE_ID,
    });

    return {
      scriptId,
      workerName,
      workerUrl: upload.workerUrl,
      success: upload.success,
      error: upload.error,
      sourceSha,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { scriptId, workerName, success: false, error: message };
  }
}

function hashSha(str: string): string {
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

export { bundleScript } from "./bundle.js";
export { bundleWorker } from "./worker-bundle.js";
