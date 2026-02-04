/**
 * Inline wrapper code for the Worker Loader dynamic isolate.
 * This string is the mainModule of the loaded worker; it imports the user's script from "./user.js"
 * and runs execute(ctx, hook). No npm deps in the dynamic worker.
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/
 */
export const DYNAMIC_WRAPPER_MAIN = `
export default {
  async fetch(request, env, ctx) {
    const payload = await request.json();
    const { session_id, formId, pageId, formData, forms = [], env: userEnv = {} } = payload;
    const prefix = "ORCR_SESSION::" + session_id + "::";
    const KV = env.KV;
    const store = KV ? {
      get: async (k) => { const v = await KV.get(prefix + k); return v ? JSON.parse(v) : null; },
      put: async (k, v) => { await KV.put(prefix + k, JSON.stringify(v)); },
      list: async (p) => { const r = await KV.list({ prefix: prefix + (p || "") }); return r.keys.map(x => x.name); }
    } : { get: async () => null, put: async () => {}, list: async () => [] };
    const hookState = {};
    const ctxObj = {
      session_id, formId, pageId, formData, forms,
      store: {
        get: (k) => store.get(k),
        list: async (keyPrefix) => {
          const keys = await store.list(keyPrefix);
          const out = {};
          for (const name of keys) {
            const short = name.slice(prefix.length);
            out[short] = await store.get(short);
          }
          return out;
        }
      },
      env: { ...env, ...userEnv }
    };
    const hook = {
      setStoreData: (key, value) => store.put(key, value),
      getStoreData: (key) => store.get(key),
      setError: (status, errorKey, message) => { hookState.error = { status, errorKey, message }; },
      setFieldError: (f, k, m) => { hookState.fieldErrors = hookState.fieldErrors || []; hookState.fieldErrors.push({ formId: f, field: k, message: m }); },
      setRedirect: (url, status) => { hookState.redirect = { url, status: status || 302 }; },
      setResponse: (payload, status) => { hookState.response = { payload, status: status || 200 }; },
      log: (level, msg, meta) => { console[level] ? console[level](msg, meta) : console.log(msg, meta); }
    };
    try {
      const m = await import("./user.js");
      const execute = m.execute || m.default?.execute;
      if (!execute) throw new Error("user.js must export execute(ctx, hook)");
      await execute(ctxObj, hook);
      if (hookState.error) return Response.json({ error: hookState.error.errorKey, message: hookState.error.message }, { status: hookState.error.status });
      if (hookState.response) return Response.json(hookState.response.payload, { status: hookState.response.status });
      if (hookState.redirect) return Response.redirect(hookState.redirect.url, hookState.redirect.status);
      return Response.json({ ok: true, fieldErrors: hookState.fieldErrors || [] });
    } catch (err) {
      console.error("Script runtime error:", err);
      return Response.json({ error: "script_runtime_error", message: (err && err.message) || String(err) }, { status: 500 });
    }
  }
};
`.trim();
