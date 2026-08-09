/**
 * Workflow Platform — dynamic form fields.
 *
 * One reusable field schema powers every form in Ordinex (applications, leave
 * requests, training, evaluations, custom community workflows). Validation is a
 * pure function so it runs identically on the server (authoritative) and client.
 */

export const FIELD_TYPES = [
  "section",
  "heading",
  "rich_text",
  "short_text",
  "long_text",
  "number",
  "currency",
  "email",
  "phone",
  "date",
  "time",
  "datetime",
  "dropdown",
  "radio",
  "checkbox",
  "multi_select",
  "file",
  "image",
  "signature",
  "rating",
  "url",
  "toggle",
  "user_select",
  "department_select",
  "role_select",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Layout-only fields carry no answer and are skipped by validation. */
export const LAYOUT_FIELD_TYPES: ReadonlySet<FieldType> = new Set([
  "section",
  "heading",
  "rich_text",
]);

export type FieldOption = { label: string; value: string };

export type FieldValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

export type VisibleIf = { fieldId: string; equals: string | number | boolean };

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  visibleIf?: VisibleIf;
  defaultValue?: unknown;
};

export type FormSchema = { fields: FormField[] };

export type SubmissionData = Record<string, unknown>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

export function isFieldVisible(field: FormField, data: SubmissionData): boolean {
  if (!field.visibleIf) return true;
  return data[field.visibleIf.fieldId] === field.visibleIf.equals;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export type ValidationResult = { valid: boolean; errors: Record<string, string> };

/**
 * Validate submission data against a form schema. Server-authoritative — never
 * trust a client-side "valid" flag. Honors conditional visibility (hidden fields
 * are not required/validated).
 */
export function validateSubmission(schema: FormSchema, data: SubmissionData): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of schema.fields) {
    if (LAYOUT_FIELD_TYPES.has(field.type)) continue;
    if (!isFieldVisible(field, data)) continue;

    const value = data[field.id];
    if (isEmpty(value)) {
      if (field.required) errors[field.id] = `${field.label} is required`;
      continue;
    }

    const v = field.validation ?? {};
    switch (field.type) {
      case "email":
        if (typeof value !== "string" || !EMAIL_RE.test(value))
          errors[field.id] = "Enter a valid email";
        break;
      case "url":
        if (typeof value !== "string" || !URL_RE.test(value))
          errors[field.id] = "Enter a valid URL";
        break;
      case "number":
      case "currency":
      case "rating": {
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(num)) {
          errors[field.id] = `${field.label} must be a number`;
        } else if (v.min !== undefined && num < v.min) {
          errors[field.id] = `${field.label} must be at least ${v.min}`;
        } else if (v.max !== undefined && num > v.max) {
          errors[field.id] = `${field.label} must be at most ${v.max}`;
        }
        break;
      }
      case "dropdown":
      case "radio": {
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        if (allowed.size > 0 && !allowed.has(String(value)))
          errors[field.id] = "Select a valid option";
        break;
      }
      case "multi_select":
      case "checkbox": {
        const allowed = new Set((field.options ?? []).map((o) => o.value));
        const arr = Array.isArray(value) ? value : [value];
        if (allowed.size > 0 && !arr.every((x) => allowed.has(String(x)))) {
          errors[field.id] = "Select valid options";
        }
        break;
      }
      case "short_text":
      case "long_text":
      case "phone": {
        const str = String(value);
        if (v.minLength !== undefined && str.length < v.minLength) {
          errors[field.id] = `${field.label} must be at least ${v.minLength} characters`;
        } else if (v.maxLength !== undefined && str.length > v.maxLength) {
          errors[field.id] = `${field.label} must be at most ${v.maxLength} characters`;
        } else if (v.pattern && !new RegExp(v.pattern).test(str)) {
          errors[field.id] = `${field.label} is invalid`;
        }
        break;
      }
      default:
        break;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Strip data down to keys present in the schema (drops unknown/injected fields). */
export function sanitizeSubmissionData(schema: FormSchema, data: SubmissionData): SubmissionData {
  const allowed = new Set(schema.fields.map((f) => f.id));
  const out: SubmissionData = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) out[key] = value;
  }
  return out;
}
