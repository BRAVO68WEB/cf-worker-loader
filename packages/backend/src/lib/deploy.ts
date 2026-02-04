import {
  deployForm as cfDeployForm,
  deploySingleScript,
  type DeployFormOptions,
  type DeployerEnv,
} from "@orcratration/deployer";
import type { FormScriptRef } from "@orcratration/shared";
import Form from "../models/form.js";
import Script from "../models/script.js";
import Deployment from "../models/deployment.js";

export interface DeployFormParams {
  formId: string;
  scripts: FormScriptRef[];
  routes?: { path: string }[];
}

export interface DeployFormResponse {
  deploymentId: string;
  status: string;
  results: Array<{ scriptId: string; workerName: string; workerUrl?: string; success: boolean; error?: string }>;
}

export async function deployFormAndPersist(
  params: DeployFormParams,
  env?: DeployerEnv
): Promise<DeployFormResponse> {
  const form = await Form.findById(params.formId).lean();
  if (!form) throw new Error("Form not found");
  const scriptRefs = params.scripts ?? (form as unknown as { scripts: FormScriptRef[] }).scripts ?? [];

  const loaderUrl = process.env.LOADER_URL ?? process.env.WORKER_LOADER_URL;
  if (loaderUrl) {
    return {
      deploymentId: "loader-" + Date.now(),
      status: "active",
      results: scriptRefs.map((r) => ({
        scriptId: String(r.scriptId),
        workerName: "loader",
        workerUrl: loaderUrl,
        success: true,
      })),
    };
  }

  const scriptIds = scriptRefs.map((r) => String(r.scriptId));
  const scriptDocs = await Script.find({ _id: { $in: scriptIds } }).lean();
  const scriptSources: Record<string, string> = {};
  for (const s of scriptDocs) {
    const doc = s as unknown as { _id: unknown; source: string };
    scriptSources[String(doc._id)] = doc.source;
  }

  const opts: DeployFormOptions = {
    formId: params.formId,
    scripts: scriptRefs,
    scriptSources,
    routes: params.routes,
  };
  const result = await cfDeployForm(opts, env);

  for (const r of result.results) {
    await Deployment.create({
      target: "form",
      formId: params.formId,
      scriptId: r.scriptId,
      workerName: r.workerName,
      workerRoute: r.workerUrl ?? undefined,
      workerUrl: r.workerUrl,
      status: r.success ? "active" : "failed",
      deployedAt: r.success ? new Date() : undefined,
      sourceSha: r.sourceSha,
      errorMessage: r.error,
    });
    if (r.success) {
      await Script.findByIdAndUpdate(r.scriptId, {
        $set: {
          lastDeployedAt: new Date(),
          deployMetadata: { workerName: r.workerName, workerUrl: r.workerUrl },
        },
      });
    }
  }

  return {
    deploymentId: result.deploymentId,
    status: result.results.every((r) => r.success) ? "active" : "queued",
    results: result.results.map((r) => ({
      scriptId: r.scriptId,
      workerName: r.workerName,
      workerUrl: r.workerUrl,
      success: r.success,
      error: r.error,
    })),
  };
}

export async function deploySingleScriptAndPersist(
  scriptId: string,
  env?: DeployerEnv
): Promise<{ deploymentId: string; success: boolean; workerUrl?: string; error?: string }> {
  const script = await Script.findById(scriptId).lean();
  if (!script) throw new Error("Script not found");
  const source = (script as unknown as { source: string }).source;
  const result = await deploySingleScript(scriptId, source, env);

  await Deployment.create({
    target: "script",
    scriptId,
    workerName: result.workerName,
    workerUrl: result.workerUrl,
    status: result.success ? "active" : "failed",
    deployedAt: result.success ? new Date() : undefined,
    sourceSha: result.sourceSha,
    errorMessage: result.error,
  });
  if (result.success) {
    await Script.findByIdAndUpdate(scriptId, {
      $set: {
        lastDeployedAt: new Date(),
        deployMetadata: { workerName: result.workerName, workerUrl: result.workerUrl },
      },
    });
  }
  return {
    deploymentId: result.scriptId + "-" + Date.now(),
    success: result.success,
    workerUrl: result.workerUrl,
    error: result.error,
  };
}
