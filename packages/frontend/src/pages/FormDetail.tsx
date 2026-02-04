import type { FlowStep, FormScriptRef, PageDef } from "@orcratration/shared";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import FormBuilder from "../components/FormBuilder";

type RawScriptRef = {
  scriptId: string | { _id: string; name?: string };
  event: string;
  order: number;
};

/** API response may have populated scriptId */
type FormDocResponse = {
  _id: string;
  name: string;
  slug: string;
  pages: PageDef[];
  scripts: RawScriptRef[];
  flow?: FlowStep[];
};

type FormDoc = {
  _id: string;
  name: string;
  slug: string;
  pages: PageDef[];
  scripts: FormScriptRef[];
  flow?: FlowStep[];
};

function normalizeScripts(raw: RawScriptRef[]): FormScriptRef[] {
  if (!raw?.length) return [];
  return raw.map((s, i) => ({
    scriptId: typeof s.scriptId === "object" ? s.scriptId._id : String(s.scriptId),
    event: s.event || "onLoad",
    order: s.order ?? i,
  }));
}

type ScriptOption = { _id: string; name: string };

export default function FormDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormDoc | null>(null);
  const [flow, setFlow] = useState<FlowStep[]>([]);
  const [availableScripts, setAvailableScripts] = useState<ScriptOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<unknown>(null);

  useEffect(() => {
    if (!id) return;
    api.get<FormDocResponse>(`/forms/${id}`).then((f) => {
      const scriptsNorm = normalizeScripts(f.scripts);
      setForm({ ...f, scripts: scriptsNorm, flow: f.flow ?? [] });
      setFlow(f.flow ?? []);
    }).catch(console.error);
  }, [id]);

  useEffect(() => {
    api.get<ScriptOption[]>("/scripts").then(setAvailableScripts).catch(console.error);
  }, []);

  async function handleSave(payload: { name: string; slug: string; pages: PageDef[] }) {
    if (!id) return;
    setSaving(true);
    try {
      const scriptsFromFlow = flow
        .filter((s): s is FlowStep & { type: "script" } => s.type === "script")
        .map((s, i) => ({ scriptId: s.scriptId, event: s.event, order: i }));
      const body = { ...payload, scripts: scriptsFromFlow, flow };
      const updated = await api.put<FormDoc & { flow?: FlowStep[] }>(`/forms/${id}`, body);
      setForm(updated);
      setFlow(updated.flow ?? []);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeploy() {
    if (!id) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const result = await api.post<{ deploymentId: string; status: string; results: unknown[] }>(
        `/forms/${id}/deploy`,
        {}
      );
      setDeployResult(result);
    } catch (err) {
      setDeployResult({ error: String(err) });
    } finally {
      setDeploying(false);
    }
  }

  if (!form) return <p>Loading…</p>;

  return (
    <>
      <h1>{form.name}</h1>
      <p>Slug: /{form.slug}</p>
      <p>
        <button type="button" onClick={() => navigate("/forms")}>
          Back to forms
        </button>
      </p>

      <section aria-labelledby="builder-heading">
        <h2 id="builder-heading">Form flow builder</h2>
        <p className="form-builder-hint">
          Plan your form flow and script triggers in one place: add pages and fields, then attach scripts and choose when they run. Drag to reorder; save to apply.
        </p>
        <FormBuilder
          form={form}
          onSave={handleSave}
          saving={saving}
          flow={flow}
          onFlowChange={setFlow}
          availableScripts={availableScripts}
        />
      </section>

      <section aria-labelledby="deploy-heading" style={{ marginTop: "2rem" }}>
        <h2 id="deploy-heading">Deploy</h2>
        <p>Steps in flow: {flow.length} (scripts: {flow.filter((s) => s.type === "script").length})</p>
        <button type="button" className="btn-primary" onClick={handleDeploy} disabled={deploying}>
          {deploying ? "Deploying…" : "Deploy"}
        </button>
      </section>

      <section aria-labelledby="fill-heading" style={{ marginTop: "2rem" }}>
        <h2 id="fill-heading">Fill form</h2>
        <p>
          <a href={`/fill/${form.slug}`} target="_blank" rel="noopener noreferrer">
            Open form as end-user → /fill/{form.slug}
          </a>
        </p>
      </section>
      {deployResult && (
        <pre className="deploy-result">{JSON.stringify(deployResult, null, 2)}</pre>
      )}
    </>
  );
}
