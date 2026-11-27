"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/types/forms";
import { addAddressAction } from "./actions";

export function AddressForm() {
  const [state, action] = useActionState(addAddressAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="CEP" name="postalCode" error={e.postalCode}>
          <Input name="postalCode" inputMode="numeric" autoComplete="postal-code" placeholder="80000-000" defaultValue={v.postalCode} invalid={!!e.postalCode} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Rua" name="street" error={e.street}>
            <Input name="street" autoComplete="address-line1" defaultValue={v.street} invalid={!!e.street} />
          </Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Número" name="number" error={e.number}>
          <Input name="number" defaultValue={v.number} invalid={!!e.number} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Complemento (opcional)" name="complement" error={e.complement}>
            <Input name="complement" autoComplete="address-line2" defaultValue={v.complement} />
          </Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
        <Field label="Bairro" name="neighborhood" error={e.neighborhood}>
          <Input name="neighborhood" defaultValue={v.neighborhood} invalid={!!e.neighborhood} />
        </Field>
        <Field label="Cidade" name="city" error={e.city}>
          <Input name="city" autoComplete="address-level2" defaultValue={v.city ?? "Curitiba"} invalid={!!e.city} />
        </Field>
        <Field label="UF" name="state" error={e.state}>
          <Input name="state" maxLength={2} autoComplete="address-level1" defaultValue={v.state ?? "PR"} invalid={!!e.state} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" className="size-4 accent-brand" /> Usar como endereço principal
      </label>
      <SubmitButton variant="outline" pendingText="Salvando…">
        Adicionar endereço
      </SubmitButton>
    </form>
  );
}
