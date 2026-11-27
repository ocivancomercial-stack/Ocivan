import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderList } from "@/features/orders/components/order-list";
import { PAYMENT_STATUS_LABEL } from "@/features/orders/status";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel do vendedor", robots: { index: false } };

export default async function SellerDashboard() {
  const user = await requireUser("/perfil/vendas");
  const sellerId = user.id; // todas as consultas abaixo são filtradas pelo próprio vendedor
  const [active, sold, toShip, orders, completed, payments, reviews, rating] = await Promise.all([
    prisma.product.count({ where: { sellerId, status: "ACTIVE" } }),
    prisma.product.count({ where: { sellerId, status: "SOLD" } }),
    prisma.order.count({ where: { sellerId, status: "PAID" } }),
    prisma.order.findMany({
      where: { sellerId, status: { not: "PENDING_PAYMENT" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, code: true, status: true, totalCents: true, createdAt: true, items: { select: { productTitleSnapshot: true, productImageSnapshot: true } } },
    }),
    prisma.order.aggregate({ where: { sellerId, status: "COMPLETED" }, _count: true, _sum: { subtotalCents: true, platformFeeCents: true } }),
    prisma.payment.findMany({
      where: { order: { sellerId }, status: { in: ["APPROVED", "REFUNDED", "CHARGED_BACK", "IN_MEDIATION"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, amountCents: true, sellerAmountCents: true, isSimulated: true, approvedAt: true, createdAt: true, order: { select: { id: true, code: true } } },
    }),
    prisma.review.findMany({ where: { reviewedUserId: sellerId }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, rating: true, comment: true, createdAt: true } }),
    prisma.review.aggregate({ where: { reviewedUserId: sellerId }, _avg: { rating: true }, _count: true }),
  ]);

  const net = (completed._sum.subtotalCents ?? 0) - (completed._sum.platformFeeCents ?? 0);
  const stats = [
    { label: "Anúncios ativos", value: active, href: "/vender/anuncios" },
    { label: "Vendidos", value: sold, href: "/vender/anuncios?aba=vendidos" },
    { label: "Aguardando envio", value: toShip },
    { label: "Vendas concluídas", value: completed._count },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Painel do vendedor</h1>
        <ButtonLink href="/vender" size="sm">Novo anúncio</ButtonLink>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Card className="p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className="text-2xl font-extrabold text-brand-900">{s.href ? <Link href={s.href}>{s.value}</Link> : s.value}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="space-y-1 p-5">
        <p className="text-sm text-muted">Valor líquido estimado de vendas concluídas (após comissão, antes das taxas do provedor)</p>
        <p className="text-3xl font-extrabold">{formatBRL(net)}</p>
        <p className="text-xs text-muted">Saldo disponível, taxas e datas de repasse são informados pelo provedor de pagamento na sua conta (integração na próxima etapa).</p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Pedidos recebidos</h2>
        <OrderList orders={orders} empty="Nenhum pedido ainda." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Histórico de transações</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">Sem transações ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-card bg-surface shadow-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="p-3">Data</th><th className="p-3">Pedido</th><th className="p-3">Situação</th><th className="p-3 text-right">Pago pelo comprador</th><th className="p-3 text-right">Seu valor (estim.)</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3">{(p.approvedAt ?? p.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3"><Link href={`/pedidos/${p.order.id}`} className="text-brand hover:underline">{p.order.code}</Link>{p.isSimulated && <span className="ml-1 text-xs text-[#7a5410]">(simulado)</span>}</td>
                    <td className="p-3">{PAYMENT_STATUS_LABEL[p.status]}</td>
                    <td className="p-3 text-right">{formatBRL(p.amountCents)}</td>
                    <td className="p-3 text-right font-semibold">{p.status === "APPROVED" ? formatBRL(p.sellerAmountCents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          Avaliações <span className="flex items-center gap-1 text-sm font-normal text-muted"><Star className="size-4 fill-accent text-accent" />{rating._count ? `${rating._avg.rating?.toFixed(1)} (${rating._count})` : "sem avaliações"}</span>
        </h2>
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-field bg-surface p-3 text-sm shadow-card">
              <p>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="text-xs text-muted">{r.createdAt.toLocaleDateString("pt-BR")}</span></p>
              {r.comment && <p className="mt-1 text-ink/80">{r.comment}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
