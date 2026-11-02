import { Hono } from "hono";
import Form from "../models/form.js";
import FormVersion from "../models/formVersion.js";
import SessionStoreModel from "../models/sessionStore.js";
import { presentSessionDetail, presentSessionList, type SessionListDoc } from "../runtime/session-list.js";
import type { FormScriptRef } from "@orcratration/shared";

type DeployResponse = Awaited<ReturnType<typeof import("../lib/deploy.js").deployFormAndPersist>>;
type DeployFn = (opts: { formId: string; scripts: FormScriptRef[]; routes?: { path: string }[] }) => Promise<DeployResponse>;

const forms = new Hono<{ Variables: { deploy: DeployFn } }>();

async function loadForm(id: string): Promise<{ _id: unknown } | null> {
  try {
    return (await Form.findById(id).lean()) as { _id: unknown } | null;
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "CastError") {
      return null;
    }
    throw err;
  }
}

forms.post("/", async (c) => {
  const body = await c.req.json();
  const doc = await Form.create(body);
  return c.json(doc, 201);
});

forms.get("/", async (c) => {
  const list = await Form.find().lean();
  return c.json(list);
});

forms.get("/by-slug/:slug", async (c) => {
  const doc = await Form.findOne({ slug: c.req.param("slug") }).lean();
  if (!doc) return c.json({ error: "not_found" }, 404);
  return c.json(doc);
});

forms.get("/:id/sessions", async (c) => {
  const form = await loadForm(c.req.param("id"));
  if (!form) return c.json({ error: "form_not_found" }, 404);
  const docs = (await SessionStoreModel.find({ formId: form._id })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean()) as SessionListDoc[];
  return c.json(presentSessionList(docs));
});

forms.get("/:id/sessions/:sessionId", async (c) => {
  const form = await loadForm(c.req.param("id"));
  if (!form) return c.json({ error: "form_not_found" }, 404);
  const doc = (await SessionStoreModel.findOne({
    sessionId: c.req.param("sessionId"),
    formId: form._id,
  }).lean()) as SessionListDoc | null;
  if (!doc) return c.json({ error: "session_not_found" }, 404);
  return c.json(presentSessionDetail(doc));
});

forms.get("/:id", async (c) => {
  const doc = await Form.findById(c.req.param("id")).populate("scripts.scriptId").lean();
  if (!doc) return c.json({ error: "not_found" }, 404);
  return c.json(doc);
});

forms.put("/:id", async (c) => {
  const body = await c.req.json();
  const doc = await Form.findByIdAndUpdate(c.req.param("id"), { $set: body }, { new: true }).lean();
  if (!doc) return c.json({ error: "not_found" }, 404);
  return c.json(doc);
});

forms.post("/:id/versions", async (c) => {
  const formId = c.req.param("id");
  const form = await Form.findById(formId).lean();
  if (!form) return c.json({ error: "not_found" }, 404);
  const f = form as unknown as { name: string; slug: string; pages: unknown[]; scripts: unknown[] };
  const last = await FormVersion.findOne({ formId }).sort({ version: -1 }).lean();
  const lastDoc = last as unknown as { version: number } | null;
  const version = (lastDoc ? lastDoc.version + 1 : 1) as number;
  const snapshot = await FormVersion.create({
    formId,
    version,
    name: f.name,
    slug: f.slug,
    pages: f.pages ?? [],
    scripts: f.scripts ?? [],
  });
  await Form.findByIdAndUpdate(formId, { $set: { currentVersionId: snapshot._id } });
  const snap = snapshot as unknown as { _id: unknown; name: string; slug: string; createdAt: Date };
  return c.json(
    { id: snap._id, formId, version, name: snap.name, slug: snap.slug, createdAt: snap.createdAt },
    201
  );
});

forms.post("/:id/deploy", async (c) => {
  const body = (await c.req.json()) as {
    target?: "form" | "script";
    scripts?: FormScriptRef[];
    routes?: { path: string }[];
  };
  const formId = c.req.param("id");
  const form = await Form.findById(formId).lean();
  if (!form) return c.json({ error: "not_found" }, 404);

  const deploy = c.get("deploy");
  const formScripts = (form as { scripts?: FormScriptRef[] }).scripts ?? [];
  const result = await deploy({
    formId,
    scripts: body.scripts ?? formScripts,
    routes: body.routes,
  });

  return c.json(result);
});

export default forms;
