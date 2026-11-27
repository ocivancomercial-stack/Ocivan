"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/types/forms";
import { forgotPasswordAction, resetPasswordAction } from "./actions";
import { PasswordInput } from "./password-input";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="E-mail da conta" name="email" error={state.errors?.email}>
        <Input name="email" type="email" autoComplete="email" defaultValue={state.values?.email} invalid={!!state.errors?.email} required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Enviando…">
        Enviar link de redefinição
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field label="Nova senha" name="password" error={e.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput name="password" autoComplete="new-password" invalid={!!e.password} required />
      </Field>
      <Field label="Confirme a nova senha" name="confirmPassword" error={e.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" invalid={!!e.confirmPassword} required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
