import type { FlowStep, PageDef } from "@orcratration/shared";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API = "/api";

type FormBySlug = {
  _id: string;
  name: string;
  slug: string;
  pages: PageDef[];
  flow?: FlowStep[];
  scripts: { scriptId: string; event: string; order: number }[];
};

function buildFlow(form: FormBySlug): FlowStep[] {
  if (form.flow?.length) return form.flow;
  const steps: FlowStep[] = (form.pages ?? []).map((p) => ({ type: "page", pageId: p.id }));
  const scriptSteps = (form.scripts ?? [])
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ type: "script" as const, scriptId: s.scriptId, event: s.event }));
  return [...steps, ...scriptSteps];
}

function generateSessionId(): string {
  return "sess-" + crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
}

export default function FormFill() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<FormBySlug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(generateSessionId);
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, Record<string, unknown>>>({});
  const [runningScript, setRunningScript] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(API + "/forms/by-slug/" + encodeURIComponent(slug))
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Form not found" : "Failed to load form");
        return r.json();
      })
      .then(setForm)
      .catch((e) => setError(e.message));
  }, [slug]);

  const flow = form ? buildFlow(form) : [];
  const currentStep = flow[stepIndex];
  const currentPage = form && currentStep?.type === "page"
    ? form.pages?.find((p) => p.id === currentStep.pageId)
    : null;

  const runScriptStep = useCallback(
    async (step: FlowStep & { type: "script" }, dataOverride?: Record<string, Record<string, unknown>>) => {
      if (!form) return;
      setRunningScript(true);
      try {
        const res = await fetch(API + "/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            formId: form._id,
            event: step.event,
            formData: dataOverride ?? formData,
            forms: [],
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } finally {
        setRunningScript(false);
      }
    },
    [form, sessionId, formData]
  );

  useEffect(() => {
    if (!currentStep || currentStep.type !== "script" || !form) return;
    let cancelled = false;
    (async () => {
      await runScriptStep(currentStep);
      if (!cancelled) setStepIndex((i) => i + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [stepIndex, currentStep?.type, currentStep?.scriptId, form?._id]);

  const advance = useCallback(async () => {
    if (currentStep?.type !== "page" || !currentPage || !form) return;
    const pageData: Record<string, unknown> = {};
    for (const f of currentPage.fields) {
      const el = document.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (el) {
        pageData[f.name] = el.type === "checkbox" ? (el as HTMLInputElement).checked : el.value;
      }
    }
    const newFormData = { ...formData, [currentStep.pageId]: pageData };
    setFormData(newFormData);

    let next = stepIndex + 1;
    while (next < flow.length && flow[next].type === "script") {
      await runScriptStep(flow[next] as FlowStep & { type: "script" }, newFormData);
      next++;
    }
    if (next >= flow.length) setComplete(true);
    setStepIndex(next);
  }, [currentStep, currentPage, form, flow, stepIndex, formData, runScriptStep]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (currentStep?.type === "page" && currentPage) {
        const pageData: Record<string, unknown> = {};
        for (const f of currentPage.fields) {
          const el = document.querySelector(`[name="${f.name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
          if (el) {
            pageData[f.name] = el.type === "checkbox" ? (el as HTMLInputElement).checked : el.value;
          }
        }
        const finalData = { ...formData, [currentStep.pageId]: pageData };
        setFormData(finalData);
        setRunningScript(true);
        try {
          await fetch(API + "/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: sessionId,
              formId: form!._id,
              event: "onSubmit",
              formData: finalData,
              forms: [],
            }),
          });
        } finally {
          setRunningScript(false);
        }
        setComplete(true);
      }
    },
    [currentStep, currentPage, form, formData, sessionId]
  );

  if (error) {
    return (
      <div className="form-fill">
        <p className="error">{error}</p>
        <a href="/">Back to home</a>
      </div>
    );
  }

  if (!form) {
    return <div className="form-fill"><p>Loading form…</p></div>;
  }

  if (complete) {
    return (
      <div className="form-fill form-fill-complete">
        <h1>{form.name}</h1>
        <p className="form-fill-done">Thank you. Your response has been submitted.</p>
        <a href="/">Back to home</a>
      </div>
    );
  }

  if (currentStep?.type === "script") {
    return (
      <div className="form-fill">
        <h1>{form.name}</h1>
        <p className="form-fill-running">{runningScript ? "Running…" : "Next…"}</p>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="form-fill">
        <h1>{form.name}</h1>
        <p>No steps in this form.</p>
      </div>
    );
  }

  const progress = flow.length ? Math.round((stepIndex / flow.length) * 100) : 0;
  const isLastPage = flow.slice(stepIndex + 1).every((s) => s.type === "script") || stepIndex + 1 >= flow.length;

  return (
    <div className="form-fill">
      <h1>{form.name}</h1>
      {currentPage.title && <h2 className="form-fill-page-title">{currentPage.title}</h2>}
      {flow.length > 1 && (
        <div className="form-fill-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="form-fill-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
      <form onSubmit={handleSubmit} className="form-fill-fields">
        {currentPage.fields.map((field) => (
          <label key={field.id} className="form-fill-field">
            <span className="form-fill-label">{field.label ?? field.name}</span>
            {field.type === "textarea" ? (
              <textarea
                name={field.name}
                placeholder={field.placeholder}
                required={Boolean(field.validation?.required)}
                defaultValue={(formData[currentStep.pageId]?.[field.name] as string) ?? ""}
              />
            ) : field.type === "checkbox" ? (
              <input
                type="checkbox"
                name={field.name}
                defaultChecked={(formData[currentStep.pageId]?.[field.name] as boolean) ?? false}
              />
            ) : (
              <input
                type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                name={field.name}
                placeholder={field.placeholder}
                required={Boolean(field.validation?.required)}
                defaultValue={(formData[currentStep.pageId]?.[field.name] as string) ?? ""}
              />
            )}
          </label>
        ))}
        <div className="form-fill-actions">
          {isLastPage ? (
            <button type="submit" className="btn-primary" disabled={runningScript}>
              {runningScript ? "Submitting…" : "Submit"}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={advance} disabled={runningScript}>
              Next
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
