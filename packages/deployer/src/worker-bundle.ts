/**
 * Bundle worker-template + user script into a single Worker script for Cloudflare.
 */

import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findWorkerTemplateEntry(): string {
  const candidates = [
    path.resolve(__dirname, "../..", "worker-template", "src", "index.ts"),
    path.resolve(__dirname, "../../..", "worker-template", "src", "index.ts"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const workerTemplateEntry = findWorkerTemplateEntry();
const deployerRoot = path.resolve(__dirname, "../..");
const packagesDir = path.dirname(path.dirname(path.dirname(workerTemplateEntry)));
const repoRoot = path.resolve(packagesDir, "..");

/**
 * Resolve @orcratration/worker-template to the workspace package path so bundling works
 * regardless of where the process is run from (backend vs deployer).
 */
const resolveWorkerTemplatePlugin: esbuild.Plugin = {
  name: "resolve-worker-template",
  setup(build) {
    build.onResolve({ filter: /^@orcratration\/worker-template$/ }, () => ({
      path: workerTemplateEntry,
      namespace: "file",
    }));
  },
};

/**
 * Produce a single Worker script (ESM) that uses createRuntime with the given user module code.
 * UserModuleCode must be ESM that exports "execute".
 */
export async function bundleWorker(userModuleCode: string): Promise<string> {
  const injectPlugin: esbuild.Plugin = {
    name: "inject-user",
    setup(build) {
      build.onResolve({ filter: /^\.\/virtual-user$/ }, () => ({ path: "\0virtual-user", namespace: "user" }));
      build.onLoad({ filter: /.*/, namespace: "user" }, () => ({
        contents: userModuleCode,
        loader: "js",
      }));
    },
  };

  const entryContent = `
import { createRuntime } from "@orcratration/worker-template";
import * as user from "./virtual-user";
export default createRuntime(user);
`;

  const result = await esbuild.build({
    stdin: {
      contents: entryContent,
      sourcefile: "worker-entry.ts",
      resolveDir: deployerRoot,
    },
    absWorkingDir: repoRoot,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "esnext",
    write: false,
    plugins: [resolveWorkerTemplatePlugin, injectPlugin],
    external: [],
    mainFields: ["module", "main", "browser"],
    conditions: ["import", "module", "default"],
    packages: "bundle",
  });

  const out = result.outputFiles?.[0];
  if (!out) throw new Error("esbuild produced no worker output");
  return new TextDecoder().decode(out.contents);
}
