import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminDashboard() {
  await requireAdmin(); // cada página revalida a permissão (layouts não re-executam em toda navegação)
  const [users, activeProducts, pendingReview, openReports, orders, fee] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { status: "IN_REVIEW" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.order.count(),
    prisma.platformSetting.findUnique({ where: { key: "platform_fee_bps" } }),
  ]);

  const stats = [
    { label: "Usuários", value: users },
    { label: "Anúncios ativos", value: activeProducts },
    { label: "Aguardando revisão", value: pendingReview },
    { label: "Denúncias abertas", value: openReports },
    { label: "Pedidos", value: orders },
    { label: "Comissão atual", value: `${(Number(fee?.value ?? 1200) / 100).toFixed(1).replace(".", ",")}%` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Dashboard</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label}>
            <Card className="p-5">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-900">{s.value}</p>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Gestão completa de usuários, anúncios, pedidos, pagamentos e configurações: Etapa 4.</p>
    </div>
  );
}
