import type { FieldDef, PageDef } from "@orcratration/shared";

export const INPUT_TYPES = [
  "text",
  "email",
  "number",
  "tel",
  "url",
  "textarea",
  "select",
  "checkbox",
  "radio",
] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export function newField(overrides?: Partial<FieldDef>): FieldDef {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "text",
    validation: {},
    ...overrides,
  };
}

export function newPage(overrides?: Partial<PageDef>): PageDef {
  return {
    id: crypto.randomUUID(),
    title: "",
    fields: [],
    ...overrides,
  };
}

export function isRequired(field: FieldDef): boolean {
  return Boolean(field.validation?.required);
}

export function setRequired(field: FieldDef, required: boolean): FieldDef {
  return {
    ...field,
    validation: { ...field.validation, required: required ? true : undefined },
  };
}
