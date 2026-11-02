import type { BindingSide } from "./scriptRowState.ts";

const KNOWN: Record<string, string> = {
  form_not_found: "This form was not found.",
  session_not_found: "No platform session with that id on this form.",
  script_not_found: "This script was not found.",
  revision_not_found: "That revision was not found.",
};

function rawText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  try {
    const body = JSON.parse(rawText(err)) as { message?: unknown; error?: unknown };
    if (typeof body.message === "string" && body.message.length > 0) return body.message;
    if (typeof body.error === "string" && body.error in KNOWN) return KNOWN[body.error];
  } catch {
    /* the body is not JSON */
  }
  return fallback;
}

export function bindFailure(err: unknown): { text: string; binding: BindingSide | null } {
  const text = apiErrorMessage(err, "Could not bind Cloudflare.");
  try {
    const body = JSON.parse(rawText(err)) as { binding?: BindingSide | null };
    return { text, binding: body.binding ?? null };
  } catch {
    return { text, binding: null };
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function isMissingForm(err: unknown): boolean {
  try {
    const body = JSON.parse(rawText(err)) as { error?: unknown };
    return body.error === "not_found" || body.error === "form_not_found";
  } catch {
    return false;
  }
}
