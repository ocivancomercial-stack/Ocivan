"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import type { AdminResult } from "./actions";

type Action = (prev: AdminResult, fd: FormData) => Promise<AdminResult>;

/** Botão/formulário de ação administrativa com feedback. */
export function AdminForm({
  action, fields = {}, label, variant = "outline", confirmText, children, className,
}: {
  action: Action; fields?: Record<string, string>; label: string; variant?: "primary" | "outline" | "ghost" | "danger";
  confirmText?: string; children?: React.ReactNode; className?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  return (
    <form action={formAction} className={className ?? "inline-flex flex-col gap-1"} onSubmit={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <SubmitButton size="sm" variant={variant}>{label}</SubmitButton>
      {state.message && <span className={`text-xs ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</span>}
      {state.errors && <Alert tone="error">{Object.values(state.errors).flat().filter(Boolean).join(" · ")}</Alert>}
    </form>
  );
}
