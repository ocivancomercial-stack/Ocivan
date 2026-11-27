"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVED_CITY_NAMES } from "@/lib/regions";
import { initialFormState } from "@/types/forms";
import { signUpAction } from "./actions";
import { PasswordInput } from "./password-input";

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUpAction, initialFormState);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Nome completo" name="name" error={e.name}>
        <Input name="name" autoComplete="name" defaultValue={v.name} invalid={!!e.name} required />
      </Field>
      <Field label="E-mail" name="email" error={e.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" defaultValue={v.email} invalid={!!e.email} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Celular (WhatsApp)" name="phone" error={e.phone}>
          <Input name="phone" type="tel" autoComplete="tel-national" inputMode="tel" placeholder="(41) 99999-9999" defaultValue={v.phone} invalid={!!e.phone} required />
        </Field>
        <Field label="Cidade" name="city" error={e.city}>
          <Select name="city" defaultValue={v.city ?? "Curitiba"} invalid={!!e.city}>
            {SERVED_CITY_NAMES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Senha" name="password" error={e.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput name="password" autoComplete="new-password" invalid={!!e.password} required />
      </Field>
      <Field label="Confirme a senha" name="confirmPassword" error={e.confirmPassword}>
        <PasswordInput name="confirmPassword" autoComplete="new-password" invalid={!!e.confirmPassword} required />
      </Field>

      <div className="space-y-1">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="termsAccepted" className="mt-0.5 size-5 accent-brand" defaultChecked={v.termsAccepted === "true"} />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="font-semibold text-brand underline">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="font-semibold text-brand underline">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
        {e.termsAccepted && <p className="text-sm text-danger" role="alert">{e.termsAccepted[0]}</p>}
      </div>

      <SubmitButton className="w-full" size="lg" pendingText="Criando conta…">
        Criar minha conta
      </SubmitButton>
    </form>
  );
}
