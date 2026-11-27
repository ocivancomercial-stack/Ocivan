import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { AdminForm } from "@/features/admin/ui";
import { AdminSearch, AdminTable } from "@/features/admin/table";
import { adminOrderAction } from "@/features/admin/actions";
import { ORDER_STATUS_LABEL } from "@/features/orders/status";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata = { title: "Pedidos" };
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const st = STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;
  const orders = await prisma.order.findMany({
    where: { ...(st ? { status: st } : {}), ...(q ? { code: { contains: q.toUpperCase() } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, code: true, status: true, totalCents: true, platformFeeCents: true, createdAt: true, buyer: { select: { email: true } }, seller: { select: { email: true } }, disputes: { select: { reason: true }, take: 1 } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Pedidos</h1>
      <AdminSearch placeholder="Código (RA-…)" defaultValue={q} extra={
        <select name="status" defaultValue={st ?? ""} className="h-10 rounded-field border border-line bg-surface px-3 text-sm">
          <option value="">Todas as situações</option>
          {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </select>
      } />
      <AdminTable head={["Código", "Data", "Comprador", "Vendedor", "Total", "Comissão", "Situação", "Ações"]}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="p-3"><Link href={`/pedidos/${o.id}`} className="font-semibold text-brand hover:underline">{o.code}</Link></td>
            <td className="p-3">{o.createdAt.toLocaleDateString("pt-BR")}</td>
            <td className="p-3">{o.buyer.email}</td>
            <td className="p-3">{o.seller.email}</td>
            <td className="p-3">{formatBRL(o.totalCents)}</td>
            <td className="p-3">{formatBRL(o.platformFeeCents)}</td>
            <td className="p-3">{ORDER_STATUS_LABEL[o.status]}{o.disputes[0] && <p className="max-w-48 text-xs text-muted">“{o.disputes[0].reason}”</p>}</td>
            <td className="flex flex-wrap gap-1 p-3">
              {["PAID", "DISPUTED"].includes(o.status) && <AdminForm action={adminOrderAction} fields={{ orderId: o.id, op: "refund" }} label="Reembolsar" variant="danger" confirmText="Reembolsar o comprador? O anúncio volta a ficar ativo." />}
              {o.status === "DISPUTED" && <AdminForm action={adminOrderAction} fields={{ orderId: o.id, op: "seller" }} label="Favor do vendedor" />}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
