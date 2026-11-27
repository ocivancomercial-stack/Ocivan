import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mocksEnabled } from "@/mocks/common";
import { mpGetPreference } from "@/mocks/mercadopago";
import { mpPayAction } from "@/mocks/actions";
import { formatBRL } from "@/lib/utils";

export const metadata = { title: "Simulador de pagamento", robots: { index: false } };

/** Imitação da tela de checkout do Mercado Pago — SOMENTE para testes. */
export default async function MpCheckoutSimulator({ params }: { params: Promise<{ id: string }> }) {
  if (!mocksEnabled()) notFound();
  const pref = await mpGetPreference((await params).id);
  if (!pref) notFound();
  const total = pref.body.items.reduce((s, i) => s + Math.round(i.unit_price * 100) * i.quantity, 0);
  return (
    <main className="min-h-dvh bg-[#ededed] px-4 py-10">
      <div className="mx-auto max-w-md space-y-4 rounded-card bg-white p-6 shadow-card">
        <p className="flex items-center gap-2 rounded-field bg-accent px-3 py-2 text-sm font-bold text-brand-900"><FlaskConical className="size-4" /> SIMULADOR — isto NÃO é o Mercado Pago real</p>
        <h1 className="text-xl font-bold">Checkout de teste</h1>
        <ul className="divide-y divide-line text-sm">
          {pref.body.items.map((i, k) => <li key={k} className="flex justify-between py-2"><span>{i.title}</span><span>{formatBRL(Math.round(i.unit_price * 100) * i.quantity)}</span></li>)}
        </ul>
        <p className="flex justify-between text-lg font-extrabold"><span>Total</span><span>{formatBRL(total)}</span></p>
        <p className="text-xs text-muted">Comissão do marketplace (marketplace_fee): {formatBRL(Math.round((pref.body.marketplace_fee ?? 0) * 100))} · Referência: {pref.body.external_reference}</p>
        <div className="grid gap-2">
          {([["approved", "Pagar (aprovar)"], ["pending", "Gerar Pix pendente"], ["rejected", "Cartão recusado"]] as const).map(([o, label]) => (
            <form key={o} action={mpPayAction}>
              <input type="hidden" name="preferenceId" value={pref.id} />
              <input type="hidden" name="outcome" value={o} />
              <Button className="w-full" variant={o === "approved" ? "primary" : "outline"}>{label}</Button>
            </form>
          ))}
        </div>
        <p className="text-xs text-muted">O simulador cria o pagamento, envia o webhook assinado (x-signature) para a plataforma e redireciona de volta — o mesmo caminho do Mercado Pago real.</p>
      </div>
    </main>
  );
}
