import { useEffect, useState } from "react";
import { api } from "../api";

type Deployment = {
  _id: string;
  target: string;
  scriptId?: string;
  formId?: string;
  workerName: string;
  workerUrl?: string;
  status: string;
  deployedAt?: string;
  errorMessage?: string;
  createdAt: string;
};

export default function Admin() {
  const [list, setList] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<Deployment[]>("/deployments").then(setList).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  return (
    <>
      <h1>Admin — Deployments</h1>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Worker</th>
            <th>Target</th>
            <th>Status</th>
            <th>URL</th>
            <th>Deployed</th>
          </tr>
        </thead>
        <tbody>
          {list.map((d) => (
            <tr key={d._id}>
              <td>{d.workerName}</td>
              <td>{d.target}</td>
              <td>{d.status}</td>
              <td>{d.workerUrl ? <a href={d.workerUrl} target="_blank" rel="noreferrer">{d.workerUrl}</a> : "—"}</td>
              <td>{d.deployedAt ? new Date(d.deployedAt).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p>No deployments yet.</p>}
    </>
  );
}
