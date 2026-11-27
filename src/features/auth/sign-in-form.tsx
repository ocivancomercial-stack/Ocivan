"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/types/forms";
import { signInAction } from "./actions";
import { PasswordInput } from "./password-input";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field label="E-mail" name="email" error={e.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} invalid={!!e.email} required />
      </Field>
      <Field label="Senha" name="password" error={e.password}>
        <PasswordInput name="password" autoComplete="current-password" invalid={!!e.password} required />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="remember" defaultChecked className="size-4 accent-brand" /> Manter conectado
        </label>
        <Link href="/recuperar-senha" className="font-semibold text-brand hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
