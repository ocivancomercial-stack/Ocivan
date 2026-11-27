"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVED_CITY_NAMES } from "@/lib/regions";
import { initialFormState } from "@/types/forms";
import { updateProfileAction } from "./actions";

export function ProfileForm({ user, cpfMasked }: { user: { name: string; phone: string | null; city: string | null }; cpfMasked?: string | null }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Field label="Nome completo" name="name" error={e.name}>
        <Input name="name" defaultValue={v.name ?? user.name} invalid={!!e.name} autoComplete="name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Celular" name="phone" error={e.phone}>
          <Input name="phone" type="tel" defaultValue={v.phone ?? user.phone ?? ""} invalid={!!e.phone} autoComplete="tel-national" />
        </Field>
        <Field label="Cidade" name="city" error={e.city}>
          <Select name="city" defaultValue={v.city ?? user.city ?? "Curitiba"}>
            {SERVED_CITY_NAMES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="CPF" name="cpf" error={e.cpf} hint={cpfMasked ? `Cadastrado: ${cpfMasked}. Preencha só para alterar.` : "Exigido pelas transportadoras para emitir etiquetas. Nunca é exibido publicamente."}>
        <Input name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" defaultValue={v.cpf ?? ""} invalid={!!e.cpf} />
      </Field>
      <SubmitButton pendingText="Salvando…">Salvar alterações</SubmitButton>
    </form>
  );
}
