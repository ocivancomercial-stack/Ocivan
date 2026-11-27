import { Card } from "@/components/ui/card";
import { ORDER_STATUS_LABEL } from "@/features/orders/status";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { daysAgo, formatBRL } from "@/lib/utils";

export const metadata = { title: "Relatórios" };
const PAID = ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"] as const;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireAdmin();
  const days = [7, 30, 90].includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 30;
  const since = daysAgo(days);
  const paidWhere = { status: { in: [...PAID] }, paidAt: { gte: since }, payments: { some: { isSimulated: false } } };
  const [real, simulated, byStatus, newUsers, newListings, topCategories] = await Promise.all([
    prisma.order.aggregate({ where: paidWhere, _count: true, _sum: { totalCents: true, subtotalCents: true, platformFeeCents: true, discountCents: true } }),
    prisma.order.count({ where: { status: { in: [...PAID] }, paidAt: { gte: since }, payments: { some: { isSimulated: true } } } }),
    prisma.order.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.product.count({ where: { publishedAt: { gte: since }, isSample: false } }),
    prisma.$queryRaw<{ name: string; total: bigint }[]>`
      SELECT c.name, COUNT(*)::bigint AS total FROM order_items oi
      JOIN orders o ON o.id = oi."orderId" JOIN products p ON p.id = oi."productId" JOIN categories c ON c.id = p."categoryId"
      WHERE o.status IN ('PAID','SHIPPED','DELIVERED','COMPLETED') AND o."paidAt" >= ${since}
      GROUP BY c.name ORDER BY total DESC LIMIT 5`,
  ]);
  const cards = [
    { label: "Pedidos pagos (reais)", value: String(real._count) },
    { label: "GMV (total pago)", value: formatBRL(real._sum.totalCents ?? 0) },
    { label: "Comissão bruta", value: formatBRL(real._sum.platformFeeCents ?? 0) },
    { label: "Descontos (cupons)", value: formatBRL(real._sum.discountCents ?? 0) },
    { label: "Ticket médio", value: formatBRL(real._count ? Math.round((real._sum.totalCents ?? 0) / real._count) : 0) },
    { label: "Novos usuários", value: String(newUsers) },
    { label: "Novos anúncios", value: String(newListings) },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Relatórios</h1>
        <nav className="flex gap-2 text-sm">{[7, 30, 90].map((d) => <a key={d} href={`?dias=${d}`} className={`rounded-full px-3 py-1 ${d === days ? "bg-brand text-white" : "bg-surface"}`}>{d} dias</a>)}</nav>
      </div>
      <p className="text-xs text-muted">Valores financeiros consideram apenas pagamentos REAIS. Pedidos pagos em modo simulado no período: {simulated}.</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => <li key={c.label}><Card className="p-4"><p className="text-xs text-muted">{c.label}</p><p className="text-2xl font-extrabold text-brand-900">{c.value}</p></Card></li>)}
      </ul>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-bold">Pedidos criados por situação</h2>
          <ul className="space-y-1 text-sm">{byStatus.map((s) => <li key={s.status} className="flex justify-between"><span>{ORDER_STATUS_LABEL[s.status]}</span><span className="font-semibold">{s._count}</span></li>)}</ul>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-bold">Subcategorias mais vendidas</h2>
          <ul className="space-y-1 text-sm">{topCategories.map((c) => <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="font-semibold">{String(c.total)}</span></li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
