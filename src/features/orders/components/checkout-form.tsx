"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2, Truck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ShippingOption } from "@/services/shipping";
import { cn, formatBRL } from "@/lib/utils";
import { placeOrderAction, quoteShippingAction } from "../actions";

type Address = { id: string; label: string };

export function CheckoutForm({ sellerId, addresses, subtotalCents, reservationMinutes, needsCpf = false }: { sellerId: string; addresses: Address[]; subtotalCents: number; reservationMinutes: number; needsCpf?: boolean }) {
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [optionId, setOptionId] = useState("");
  const [quoteError, setQuoteError] = useState<string>();
  const [quoting, startQuote] = useTransition();
  const [state, action] = useActionState(placeOrderAction, { ok: false });

  useEffect(() => {
    if (!addressId) return;
    startQuote(async () => {
      const res = await quoteShippingAction(sellerId, addressId);
      if (!res.ok) {
        setOptions([]);
        setQuoteError(res.message);
        return;
      }
      setQuoteError(undefined);
      setOptions(res.options);
      setOptionId(res.options[0]?.id ?? "");
    });
  }, [addressId, sellerId]);

  const shipping = options.find((o) => o.id === optionId);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="sellerId" value={sellerId} />
      <input type="hidden" name="addressId" value={addressId} />
      <input type="hidden" name="shippingOptionId" value={optionId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <section className="space-y-2">
        <h2 className="font-bold">Endereço de entrega</h2>
        {addresses.map((a) => (
          <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-field border p-3 text-sm", a.id === addressId ? "border-brand bg-brand-50" : "border-line bg-surface")}>
            <input type="radio" checked={a.id === addressId} onChange={() => setAddressId(a.id)} className="accent-brand" />
            {a.label}
          </label>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-bold"><Truck className="size-5 text-brand" /> Entrega</h2>
        {quoting && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Calculando frete…</p>}
        {quoteError && <Alert tone="error">{quoteError}</Alert>}
        {!quoting && options.map((o) => (
          <label key={o.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-field border p-3 text-sm", o.id === optionId ? "border-brand bg-brand-50" : "border-line bg-surface")}>
            <span className="flex items-center gap-3">
              <input type="radio" checked={o.id === optionId} onChange={() => setOptionId(o.id)} className="accent-brand" />
              <span>
                <span className="block font-semibold">{o.name}</span>
                <span className="block text-xs text-muted">até {o.estimatedDays} dia(s) útil(eis){o.isSimulated ? " · valor SIMULADO" : ""}</span>
              </span>
            </span>
            <span className="font-bold">{o.priceCents === 0 ? "Grátis" : formatBRL(o.priceCents)}</span>
          </label>
        ))}
      </section>

      {needsCpf && shipping?.kind === "carrier" && (
        <Field label="CPF do destinatário" name="cpf" hint="A transportadora exige para emitir a etiqueta. Fica salvo no seu perfil e nunca é exibido.">
          <Input name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
        </Field>
      )}
      <Field label="Cupom (opcional)" name="couponCode">
        <Input name="couponCode" maxLength={30} className="uppercase" autoComplete="off" />
      </Field>

      <section className="space-y-1 rounded-card bg-surface p-4 text-sm shadow-card">
        <div className="flex justify-between"><span>Produtos</span><span>{formatBRL(subtotalCents)}</span></div>
        <div className="flex justify-between"><span>Frete</span><span>{shipping ? formatBRL(shipping.priceCents) : "—"}</span></div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold"><span>Total</span><span>{shipping ? formatBRL(subtotalCents + shipping.priceCents) : "—"}</span></div>
        <p className="pt-1 text-xs text-muted">Cupom é validado e descontado na próxima etapa. Ao continuar, as peças ficam reservadas para você por {reservationMinutes} minutos.</p>
      </section>

      <SubmitButton size="lg" className="w-full" disabled={!shipping || quoting} pendingText="Reservando…">Continuar para o pagamento</SubmitButton>
    </form>
  );
}
