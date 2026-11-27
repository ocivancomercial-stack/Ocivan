"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PasswordInput } from "@/features/auth/password-input";
import { deleteAccountAction } from "./actions";

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccountAction, {});
  if (!open) return <Button variant="outline" className="text-danger" onClick={() => setOpen(true)}>Quero excluir minha conta</Button>;
  return (
    <form action={action} className="space-y-3">
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field label="Sua senha" name="password">
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>
      <Field label='Digite "EXCLUIR" para confirmar' name="confirm">
        <Input name="confirm" autoComplete="off" required />
      </Field>
      <SubmitButton variant="danger" pendingText="Excluindo…">Excluir minha conta definitivamente</SubmitButton>
    </form>
  );
}
