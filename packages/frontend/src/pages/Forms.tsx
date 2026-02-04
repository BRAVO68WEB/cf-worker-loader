import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type FormDoc = { _id: string; name: string; slug: string };

export default function Forms() {
  const [forms, setForms] = useState<FormDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<FormDoc[]>("/forms").then(setForms).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  return (
    <>
      <h1>Forms</h1>
      <p>
        <Link to="/forms/new" className="btn-primary">Create form</Link>
      </p>
      <ul className="card-list">
        {forms.map((f) => (
          <li key={f._id}>
            <Link to={`/forms/${f._id}`}>
              {f.name} <small>(/{f.slug})</small>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
