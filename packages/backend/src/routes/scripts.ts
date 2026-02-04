import { Hono } from "hono";
import Script from "../models/script.js";
import Deployment from "../models/deployment.js";
import { deploySingleScriptAndPersist } from "../lib/deploy.js";

function getDeployEnv() {
  return {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    KV_NAMESPACE_ID: process.env.KV_NAMESPACE_ID,
  };
}

const scripts = new Hono();

scripts.get("/", async (c) => {
  const list = await Script.find().lean();
  return c.json(list);
});

scripts.post("/", async (c) => {
  const body = await c.req.json();
  const doc = await Script.create(body);
  return c.json(doc, 201);
});

scripts.get("/:id", async (c) => {
  const doc = await Script.findById(c.req.param("id")).lean();
  if (!doc) return c.json({ error: "not_found" }, 404);
  return c.json(doc);
});

scripts.put("/:id", async (c) => {
  const body = await c.req.json();
  const doc = await Script.findByIdAndUpdate(c.req.param("id"), { $set: body }, { new: true }).lean();
  if (!doc) return c.json({ error: "not_found" }, 404);
  return c.json(doc);
});

scripts.post("/:id/deploy", async (c) => {
  const scriptId = c.req.param("id");
  try {
    const result = await deploySingleScriptAndPersist(scriptId, getDeployEnv());
    return c.json(
      {
        deploymentId: result.deploymentId,
        status: result.success ? "active" : "failed",
        workerUrl: result.workerUrl,
        error: result.error,
      },
      202
    );
  } catch (err) {
    if ((err as Error).message === "Script not found")
      return c.json({ error: "not_found" }, 404);
    throw err;
  }
});

scripts.get("/:id/history", async (c) => {
  const scriptId = c.req.param("id");
  const list = await Deployment.find({ scriptId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return c.json(
    list.map((d) => {
      const x = d as unknown as { _id: unknown; workerName: string; workerUrl?: string; status: string; deployedAt?: Date; errorMessage?: string };
      return { id: x._id, workerName: x.workerName, workerUrl: x.workerUrl, status: x.status, deployedAt: x.deployedAt, errorMessage: x.errorMessage };
    })
  );
});

export default scripts;
