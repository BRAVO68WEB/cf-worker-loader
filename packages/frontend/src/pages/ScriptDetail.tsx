import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";

type ScriptDoc = { _id: string; name: string; source: string; version?: number };

export default function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [script, setScript] = useState<ScriptDoc | null>(null);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<unknown>(null);

  useEffect(() => {
    if (!id) return;
    api.get<ScriptDoc>(`/scripts/${id}`).then((s) => {
      setScript(s);
      setSource(s.source);
    }).catch(console.error);
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/scripts/${id}`, { ...script, source });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeploy() {
    if (!id) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      await api.put(`/scripts/${id}`, { ...script, source });
      const result = await api.post<{ deploymentId: string; status: string; workerUrl?: string }>(
        `/scripts/${id}/deploy`
      );
      setDeployResult(result);
    } catch (err) {
      setDeployResult({ error: String(err) });
    } finally {
      setDeploying(false);
    }
  }

  if (!script) return <p>Loading…</p>;
  return (
    <>
      <h1>{script.name}</h1>
      <p>
        <button type="button" onClick={() => navigate("/scripts")}>Back</button>
        <button type="button" onClick={handleSave} disabled={saving}>Save</button>
        <button type="button" onClick={handleDeploy} disabled={deploying}>
          {deploying ? "Deploying…" : "Deploy"}
        </button>
      </p>
      <label>
        <div>Source: export execute(ctx, hook)</div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={20}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
      </label>
      {deployResult && (
        <pre className="deploy-result">{JSON.stringify(deployResult, null, 2)}</pre>
      )}
    </>
  );
}
