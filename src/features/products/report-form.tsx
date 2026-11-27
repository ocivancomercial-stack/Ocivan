"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { REPORT_REASONS } from "./constants";
import { reportProductAction, type ReportState } from "./actions";

export function ReportForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportProductAction, {} as ReportState);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
        <Flag className="size-3.5" /> Denunciar anúncio
      </button>
    );
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-3 rounded-card border border-line bg-surface p-4">
      <input type="hidden" name="productId" value={productId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field label="Motivo da denúncia" name="reason">
        <Select name="reason" defaultValue="">
          <option value="" disabled>Selecione…</option>
          {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Detalhes (opcional)" name="description">
        <Textarea name="description" maxLength={500} rows={2} />
      </Field>
      <SubmitButton size="sm" variant="danger">Enviar denúncia</SubmitButton>
    </form>
  );
}
