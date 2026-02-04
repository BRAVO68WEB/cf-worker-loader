import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function FormNew() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ _id: string }>("/forms", { name, slug, pages: [], scripts: [] });
      navigate(`/forms/${res._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create form");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Create form</h1>
      <p>
        <Link to="/forms">← Back to forms</Link>
      </p>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Slug <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-form" required />
        </label>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create form"}
        </button>
      </form>
    </>
  );
}
