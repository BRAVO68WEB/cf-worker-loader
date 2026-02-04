/**
 * Bundle user script source into Worker-compatible module (export execute).
 * Supports CJS (exports.execute = ...) and ESM (export execute / export default { execute }).
 */

import * as esbuild from "esbuild";

export interface BundleResult {
  code: string;
  warnings: string[];
}

const CJS_WRAPPER = `
const __exports = {};
const exports = __exports;
const module = { exports: __exports };
`;

/**
 * Bundle raw script source to ESM that exports execute(ctx, hook).
 * Validates that execute is present after bundle.
 */
export async function bundleScript(source: string): Promise<BundleResult> {
  const warnings: string[] = [];
  const entry = CJS_WRAPPER + source + "\n;\nexport const execute = __exports.execute;";

  const result = await esbuild.build({
    stdin: {
      contents: entry,
      sourcefile: "user-script.js",
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "esnext",
    write: false,
    logLevel: "silent",
  });

  const out = result.outputFiles?.[0];
  if (!out) throw new Error("esbuild produced no output");
  let code = new TextDecoder().decode(out.contents);

  if (result.warnings.length) {
    for (const w of result.warnings) {
      warnings.push(w.text);
    }
  }

  if (!code.includes("execute")) {
    throw new Error("Script must export execute(ctx, hook)");
  }
  return { code, warnings };
}
