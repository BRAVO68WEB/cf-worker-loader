import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import "../admin/admin.css";
import { FormList } from "../admin/FormList";
import { RuntimeSwitch } from "../admin/RuntimeSwitch";
import { ScriptRows } from "../admin/ScriptRows";
import { SessionPanel } from "../admin/SessionPanel";
import { isAbortError, isMissingForm } from "../admin/apiErrorMessage";
import { playerHref, runtimeLabel, scriptSteps, sortForms } from "../admin/desk";

interface FormListItem {
  _id: string;
  name: string;
  slug: string;
  runtime?: "platform" | "cloudflare";
}

interface DeskForm extends FormListItem {
  flow?: { id: string; type: string; scriptId?: unknown }[];
}

function playerOrigin(): string | undefined {
  const env = import.meta.env as { VITE_PLAYER_ORIGIN?: string } | undefined;
  return env?.VITE_PLAYER_ORIGIN;
}

export default function Admin() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormListItem[] | null>(null);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [form, setForm] = useState<DeskForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [gate, setGate] = useState<{ formId: string; pending: boolean; labels: string[] }>({
    formId: "",
    pending: true,
    labels: [],
  });

  useEffect(() => {
    const id = "orcratration-outfit";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<FormListItem[]>("/forms", controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setForms(sortForms(rows.map((row) => ({ ...row, _id: String(row._id) }))));
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setFormsError("Could not load forms.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (formId || !forms || forms.length === 0) return;
    navigate(`/admin/${forms[0]._id}`, { replace: true });
  }, [formId, forms, navigate]);

  useEffect(() => {
    if (!formId) return;
    const controller = new AbortController();
    setForm(null);
    setFormError(null);
    api
      .get<DeskForm>(`/forms/${formId}`, controller.signal)
      .then((doc) => {
        if (controller.signal.aborted) return;
        setForm({ ...doc, _id: String(doc._id) });
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setFormError(isMissingForm(err) ? "This form was not found." : "Could not load this form.");
      });
    return () => controller.abort();
  }, [formId]);

  function applyRuntime(runtime: "platform" | "cloudflare") {
    setForm((current) => (current ? { ...current, runtime } : current));
    setForms((current) => current?.map((row) => (row._id === formId ? { ...row, runtime } : row)) ?? current);
  }

  return (
    <div className="night-desk">
      {forms && forms.length > 0 ? <FormList forms={forms} selectedId={formId} /> : <div className="form-list" />}
      <div className="desk">
        {formsError ? <p>{formsError}</p> : null}
        {!forms && !formsError ? <p>Loading…</p> : null}
        {forms && forms.length === 0 ? (
          <p>
            No forms yet. <Link to="/forms/new">Create form</Link>
          </p>
        ) : null}
        {formId && !form && !formError ? <p>Loading…</p> : null}
        {formError ? <p>{formError}</p> : null}
        {form ? (
          <>
            <header className="desk-header">
              <div>
                <h1>{form.name}</h1>
                <p className="muted">{runtimeLabel(form.runtime)}</p>
              </div>
              <a href={playerHref(form.slug, playerOrigin())} target="_blank" rel="noreferrer">
                Open player
              </a>
            </header>
            <RuntimeSwitch
              formId={form._id}
              runtime={form.runtime}
              pending={gate.formId === form._id ? gate.pending : true}
              labels={gate.formId === form._id ? gate.labels : []}
              onRuntime={applyRuntime}
            />
            <ScriptRows
              key={form._id}
              steps={scriptSteps(form.flow)}
              onGate={(next) => setGate({ formId: form._id, ...next })}
            />
            <SessionPanel key={form._id} formId={form._id} slug={form.slug} />
          </>
        ) : null}
      </div>
    </div>
  );
}
