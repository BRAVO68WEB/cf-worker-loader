import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type ScriptDoc = { _id: string; name: string; version?: number };

export default function Scripts() {
  const [scripts, setScripts] = useState<ScriptDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<ScriptDoc[]>("/scripts").then(setScripts).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  return (
    <>
      <h1>Scripts</h1>
      <p>
        <Link to="/scripts/new">Create script</Link>
      </p>
      <ul className="card-list">
        {scripts.map((s) => (
          <li key={s._id}>
            <Link to={`/scripts/${s._id}`}>
              {s.name} <small>v{s.version ?? 1}</small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
