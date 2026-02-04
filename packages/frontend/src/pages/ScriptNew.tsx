import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const DEFAULT_SOURCE = `exports.execute = async (ctx, hook) => {
  hook.log("info", "Hello from script", { session_id: ctx.session_id });
};
`;

export default function ScriptNew() {
  const [name, setName] = useState("");
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post<{ _id: string }>("/scripts", { name, source, version: 1 });
    navigate(`/scripts/${res._id}`);
  }

  return (
    <>
      <h1>New script</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Source
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={12}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </label>
        <button type="submit">Create</button>
      </form>
    </>
  );
}
