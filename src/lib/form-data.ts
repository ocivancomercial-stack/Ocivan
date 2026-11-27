import type { z } from "zod";
import type { FormState } from "@/types/forms";

/** Converte FormData em objeto simples (checkbox "on" → true). */
export function formToObject(formData: FormData, booleans: string[] = []): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") obj[key] = value;
  for (const key of booleans) obj[key] = formData.get(key) === "on" || formData.get(key) === "true";
  return obj;
}

/** Valores para repopular o formulário em caso de erro (nunca devolve senhas). */
export function echoValues(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => typeof v === "string" && !/password/i.test(k)) as [string, string][],
  );
}

export function zodErrors(error: z.ZodError): FormState["errors"] {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}
