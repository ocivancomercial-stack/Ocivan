import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, FlaskConical } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { startPaymentAction } from "@/features/orders/actions";
import { CancelForm, DisputeForm, LabelForm, ReceiveForm, ReviewForm, ShipForm, TrackForm } from "@/features/orders/components/order-actions";
import { getShippingProvider } from "@/services/shipping";
import { mocksEnabled } from "@/mocks/common";
import { meAdvanceAction } from "@/mocks/actions";
import { getOrderForUser } from "@/features/orders/service";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/features/orders/status";
import { simulatePaymentAction } from "@/features/payments/simulation-actions";
import { publicName } from "@/features/products/queries";
import { simulationAllowed } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

const STEPS: { status: OrderStatus[]; label: string }[] = [
  { status: ["PENDING_PAYMENT"], label: "Pedido criado" },
  { status: ["PAID"], label: "Pagamento confirmado" },
  { status: ["SHIPPED"], label: "Enviado" },
  { status: ["DELIVERED", "COMPLETED"], label: "Entregue" },
];
const ORDER_FLOW: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED", "COMPLETED"];

type Addr = { recipient?: string | null; street: string; number: string; complement?: string | null; neighborhood: string; city: string; state: string; postalCode: string };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/pedidos/${id}`);
  const found = await getOrderForUser(id, user);
  if (!found) notFound(); // pedido de terceiros → 404 (não revela existência)
  const { order, role } = found;
  const idx = ORDER_FLOW.indexOf(order.status);
  const address = order.shippingAddress as Addr | null;
  const pendingPayment = order.payments.find((p) => p.status === "PENDING");
  const isLocal = order.shippingServiceId === "local-pickup";
  const myReview = order.reviews.find((r) => r.reviewerId === user.id);
  const expired = order.expiresAt && order.expiresAt < new Date();
  const shippingProvider = getShippingProvider();
  const labelMode = shippingProvider.supportsLabels && !!order.shippingServiceId?.startsWith("me-");
  const label = order.shipments.find((s) => s.labelUrl && s.status !== "CANCELED");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Pedido {order.code}</h1>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-900">{ORDER_STATUS_LABEL[order.status]}</span>
      </div>
      <p className="text-sm text-muted">
        {role === "buyer" ? `Vendedor: ${publicName(order.seller.name)}` : `Comprador: ${role === "admin" ? order.buyer.name : publicName(order.buyer.name)}`} · criado em {order.createdAt.toLocaleString("pt-BR")}
      </p>

      {idx >= 0 && (
        <ol className="grid grid-cols-4 gap-2 text-center text-xs">
          {STEPS.map((s) => {
            const done = idx >= ORDER_FLOW.indexOf(s.status[0]);
            return (
              <li key={s.label} className={done ? "text-brand" : "text-muted"}>
                {done ? <CheckCircle2 className="mx-auto size-6" /> : <Circle className="mx-auto size-6" />}
                <span className="mt-1 block font-semibold">{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}
      {order.status === "CANCELED" && <Alert tone="warning">Cancelado: {order.cancelReason ?? "—"}</Alert>}
      {order.status === "DISPUTED" && <Alert tone="warning">Pedido em disputa. A equipe Repassa Aí vai analisar e entrar em contato.</Alert>}

      {/* Pagamento */}
      {order.status === "PENDING_PAYMENT" && role === "buyer" && (
        <Card className="space-y-4 p-5">
          <h2 className="font-bold">Pagamento</h2>
          {expired ? (
            <Alert tone="error">O prazo de pagamento expirou e as peças foram liberadas.</Alert>
          ) : (
            <>
              <p className="text-sm text-muted">Peças reservadas para você até <strong>{order.expiresAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>. O pedido só é confirmado quando o provedor de pagamento aprovar.</p>
              {order.paymentStatus === "REJECTED" && <Alert tone="error">Pagamento recusado. Tente novamente com outro meio de pagamento.</Alert>}
              {!pendingPayment ? (
                <form action={startPaymentAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <SubmitButton size="lg" className="w-full" pendingText="Abrindo pagamento…">Pagar {formatBRL(order.totalCents)}</SubmitButton>
                </form>
              ) : pendingPayment.provider !== "simulated" ? (
                <form action={startPaymentAction} className="space-y-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <p className="text-sm text-muted">Pagamento iniciado. Se ainda não concluiu, continue no {pendingPayment.isSimulated ? "simulador do Mercado Pago" : "Mercado Pago"}. A confirmação chega automaticamente.</p>
                  <SubmitButton size="lg" className="w-full" pendingText="Abrindo…">Continuar pagamento</SubmitButton>
                </form>
              ) : pendingPayment.isSimulated && pendingPayment.providerPaymentId && simulationAllowed() ? (
                <div className="space-y-3 rounded-field border-2 border-dashed border-accent bg-accent-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-[#7a5410]"><FlaskConical className="size-4" /> PAGAMENTO SIMULADO — ambiente de desenvolvimento</p>
                  <p className="text-xs text-[#7a5410]">Nenhum dinheiro é movimentado. Os botões mudam o estado no provedor simulado e disparam o mesmo fluxo de confirmação do webhook real.</p>
                  <div className="flex flex-wrap gap-2">
                    {(["APPROVED", "PENDING", "REJECTED"] as const).map((st) => (
                      <form key={st} action={simulatePaymentAction}>
                        <input type="hidden" name="paymentId" value={pendingPayment.providerPaymentId!} />
                        <input type="hidden" name="status" value={st} />
                        <Button size="sm" variant={st === "APPROVED" ? "primary" : "outline"}>
                          {st === "APPROVED" ? "Simular aprovado" : st === "PENDING" ? "Simular pendente" : "Simular recusado"}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Aguardando confirmação do provedor de pagamento…</p>
              )}
            </>
          )}
          <CancelForm orderId={order.id} paid={false} />
        </Card>
      )}

      {/* Ações do vendedor */}
      {role === "seller" && order.status === "PAID" && (
        <Card className="space-y-3 p-5">
          <h2 className="font-bold">Envie o produto</h2>
          <p className="text-sm text-muted">Entrega: {order.shippingServiceName}. Embale bem e informe o envio.</p>
          {labelMode ? (
            label ? (
              <div className="space-y-2 text-sm">
                <p>Etiqueta pronta{label.isSimulated && <strong className="text-[#7a5410]"> (SIMULADA — não vale para postagem)</strong>}. Imprima, cole no pacote e poste.</p>
                <a href={label.labelUrl!} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">Abrir etiqueta</a>
              </div>
            ) : (
              <LabelForm orderId={order.id} />
            )
          ) : (
            <ShipForm orderId={order.id} isLocal={isLocal} />
          )}
        </Card>
      )}

      {/* Ações do comprador */}
      {role === "buyer" && ["PAID", "SHIPPED", "DELIVERED"].includes(order.status) && (
        <Card className="space-y-3 p-5">
          {order.status === "PAID" && <p className="text-sm text-muted">Aguardando o vendedor enviar.</p>}
          {["SHIPPED", "DELIVERED"].includes(order.status) && <ReceiveForm orderId={order.id} />}
          {order.status === "PAID" && <CancelForm orderId={order.id} paid />}
          <DisputeForm orderId={order.id} />
        </Card>
      )}

      {order.status === "COMPLETED" && role !== "admin" && (
        <Card className="p-5">
          {myReview ? <p className="text-sm text-muted">Você avaliou com {myReview.rating} estrela(s). Obrigado!</p> : <ReviewForm orderId={order.id} target={role === "buyer" ? "o vendedor" : "o comprador"} />}
        </Card>
      )}

      {/* Itens e valores */}
      <Card className="space-y-4 p-5">
        <ul className="space-y-3">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-field bg-brand-50">
                {i.productImageSnapshot && <Image src={i.productImageSnapshot} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="text-sm">
                <Link href={`/produto/${i.productId}`} className="font-semibold hover:underline">{i.productTitleSnapshot}</Link>
                <p>{formatBRL(i.unitPriceCents)}</p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt>Produtos</dt><dd>{formatBRL(order.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Frete ({order.shippingServiceName})</dt><dd>{formatBRL(order.shippingPriceCents)}</dd></div>
          {order.discountCents > 0 && <div className="flex justify-between"><dt>Desconto</dt><dd>− {formatBRL(order.discountCents)}</dd></div>}
          <div className="flex justify-between text-base font-extrabold"><dt>Total</dt><dd>{formatBRL(order.totalCents)}</dd></div>
          {role !== "buyer" && (
            <>
              <div className="flex justify-between pt-2 text-muted"><dt>Comissão ({order.platformFeeBps / 100}%)</dt><dd>− {formatBRL(order.platformFeeCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Valor do vendedor (estimativa)</dt><dd>{formatBRL(order.subtotalCents - order.platformFeeCents)}</dd></div>
              <p className="text-xs text-muted">Antes das taxas do provedor de pagamento. O valor e a data do repasse são definidos pelo provedor.</p>
            </>
          )}
        </dl>
      </Card>

      {address && role !== "admin" && (
        <Card className="p-5 text-sm">
          <h2 className="mb-1 font-bold">Entrega</h2>
          {role === "seller" && !["PAID", "SHIPPED"].includes(order.status) ? (
            <p className="text-muted">O endereço do comprador fica visível apenas enquanto o pedido estiver pago e aguardando entrega.</p>
          ) : (
            <p>{address.recipient && `${address.recipient} · `}{address.street}, {address.number}{address.complement ? ` — ${address.complement}` : ""}, {address.neighborhood}, {address.city}/{address.state} · CEP {address.postalCode.replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
          )}
          {order.shipments.map((s) => (
            <div key={s.id} className="mt-3 border-t border-line pt-3">
              <p className="font-semibold">{s.serviceName}{s.trackingCode && ` · Rastreio ${s.trackingCode}`}{s.isSimulated && <span className="ml-1 text-xs text-[#7a5410]">(simulado)</span>}</p>
              {s.provider !== "manual" && ["LABEL_GENERATED", "POSTED", "IN_TRANSIT"].includes(s.status) && <TrackForm orderId={order.id} />}
              {s.isSimulated && mocksEnabled() && role !== "buyer" && ["LABEL_GENERATED", "POSTED"].includes(s.status) && (
                <form action={meAdvanceAction} className="mt-1">
                  <input type="hidden" name="shipmentId" value={s.id} />
                  <Button size="sm" variant="outline">Simulador: transportadora {s.status === "LABEL_GENERATED" ? "recebeu a postagem" : "entregou"}</Button>
                </form>
              )}
              <ul className="mt-1 space-y-1 text-muted">
                {s.events.map((e) => <li key={e.id}>{e.occurredAt.toLocaleString("pt-BR")} — {e.description}</li>)}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {order.payments.length > 0 && (
        <p className="text-xs text-muted">
          Pagamento: {PAYMENT_STATUS_LABEL[order.payments[0].status]} via {order.payments[0].isSimulated ? "provedor SIMULADO" : order.payments[0].provider}.
        </p>
      )}
    </div>
  );
}
