import { Link } from "react-router-dom";
import { runtimeLabel } from "./desk.ts";

export function FormList({
  forms,
  selectedId,
}: {
  forms: { _id: string; name: string; runtime?: string }[];
  selectedId?: string;
}) {
  return (
    <div className="form-list">
      {forms.map((form) => (
        <Link key={form._id} to={`/admin/${form._id}`} className={form._id === selectedId ? "is-selected" : undefined}>
          <span className="form-name">{form.name}</span>
          <span className="muted">{runtimeLabel(form.runtime)}</span>
        </Link>
      ))}
    </div>
  );
}
