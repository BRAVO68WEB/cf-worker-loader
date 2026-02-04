/**
 * Form & script entity types (align with MongoDB models).
 */

export interface FieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface FieldDef {
  id: string;
  name: string;
  label?: string;
  type: string;
  placeholder?: string;
  validation?: FieldValidation;
}

export interface PageDef {
  id: string;
  title?: string;
  fields: FieldDef[];
}

export interface FormScriptRef {
  scriptId: string;
  event: string;
  order: number;
}

/** A single step in the form flow: show a form page or run a script */
export type FlowStep =
  | { type: "page"; pageId: string }
  | { type: "script"; scriptId: string; event: string };

export interface Form {
  id: string;
  name: string;
  slug: string;
  pages: PageDef[];
  scripts: FormScriptRef[];
  /** Ordered sequence: Start → steps → End. If set, defines form flow and script triggers. */
  flow?: FlowStep[];
  currentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Script {
  id: string;
  name: string;
  source: string;
  version: number;
  createdAt: Date;
  lastDeployedAt?: Date;
  deployMetadata?: Record<string, unknown>;
}

export type HookEvent = "onLoad" | "onValidate" | "onSubmit" | "onPageChange";

export interface Deployment {
  id: string;
  target: string;
  workerName: string;
  workerRoute: string;
  status: "queued" | "building" | "deploying" | "active" | "failed";
  deployedAt?: Date;
  sourceSha?: string;
}
