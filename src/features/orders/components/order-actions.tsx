"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { orderAction } from "../actions";

function ActionForm({ orderId, action, children, confirmText }: { orderId: string; action: string; children: React.ReactNode; confirmText?: string }) {
  const [state, formAction] = useActionState(orderAction, { ok: false });
  return (
    <form action={formAction} onSubmit={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="action" value={action} />
      {state.message && <Alert tone="error">{state.message}</Alert>}
      {children}
    </form>
  );
}

export function ShipForm({ orderId, isLocal }: { orderId: string; isLocal: boolean }) {
  return (
    <ActionForm orderId={orderId} action="ship">
      {!isLocal && (
        <Field label="Código de rastreio" name="trackingCode" hint="Etiqueta automática pela plataforma: em breve (integração com transportadoras).">
          <Input name="trackingCode" placeholder="AA123456789BR" className="uppercase" required />
        </Field>
      )}
      <SubmitButton pendingText="Salvando…">{isLocal ? "Confirmar que saiu para entrega" : "Informar envio"}</SubmitButton>
    </ActionForm>
  );
}

export function ReceiveForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm orderId={orderId} action="receive" confirmText="Confirma que recebeu o produto como anunciado? Isso conclui o pedido.">
      <SubmitButton pendingText="Confirmando…">Recebi o produto</SubmitButton>
    </ActionForm>
  );
}

export function CancelForm({ orderId, paid }: { orderId: string; paid: boolean }) {
  return (
    <ActionForm orderId={orderId} action="cancel" confirmText={paid ? "Cancelar e solicitar reembolso?" : "Cancelar este pedido? As peças serão liberadas."}>
      <SubmitButton variant="ghost" className="text-danger" pendingText="Cancelando…">{paid ? "Cancelar e pedir reembolso" : "Cancelar pedido"}</SubmitButton>
    </ActionForm>
  );
}

export function DisputeForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Tenho um problema com este pedido</Button>;
  return (
    <ActionForm orderId={orderId} action="dispute">
      <Field label="Descreva o problema" name="reason">
        <Textarea name="reason" minLength={10} maxLength={1000} rows={3} required />
      </Field>
      <SubmitButton variant="danger" size="sm" pendingText="Enviando…">Abrir disputa</SubmitButton>
    </ActionForm>
  );
}

export function ReviewForm({ orderId, target }: { orderId: string; target: string }) {
  const [rating, setRating] = useState(5);
  return (
    <ActionForm orderId={orderId} action="review">
      <p className="text-sm font-semibold">Avalie {target}</p>
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} estrela(s)`} onClick={() => setRating(n)}>
            <Star className={`size-7 ${n <= rating ? "fill-accent text-accent" : "text-line"}`} />
          </button>
        ))}
      </div>
      <Textarea name="comment" maxLength={500} rows={2} placeholder="Comentário (opcional)" />
      <SubmitButton size="sm" pendingText="Enviando…">Enviar avaliação</SubmitButton>
    </ActionForm>
  );
}

export function LabelForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm orderId={orderId} action="label">
      <SubmitButton pendingText="Gerando etiqueta…">Gerar etiqueta de envio</SubmitButton>
    </ActionForm>
  );
}

export function TrackForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm orderId={orderId} action="track">
      <SubmitButton size="sm" variant="ghost" pendingText="Consultando…">Atualizar rastreio</SubmitButton>
    </ActionForm>
  );
}
