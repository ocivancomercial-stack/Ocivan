import Link from "next/link";
import { AdminTable } from "@/features/admin/table";
import { PAYMENT_STATUS_LABEL } from "@/features/orders/status";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata = { title: "Pagamentos" };

export default async function AdminPayments() {
  await requireAdmin();
  const [payments, webhooks] = await Promise.all([
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { id: true, code: true } } } }),
    prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Pagamentos</h1>
      <AdminTable head={["Data", "Pedido", "Provedor", "ID no provedor", "Situação", "Valor", "Comissão", "Vendedor (estim.)"]}>
        {payments.map((p) => (
          <tr key={p.id}>
            <td className="p-3">{p.createdAt.toLocaleString("pt-BR")}</td>
            <td className="p-3"><Link href={`/pedidos/${p.order.id}`} className="text-brand hover:underline">{p.order.code}</Link></td>
            <td className="p-3">{p.isSimulated ? <span className="font-semibold text-[#7a5410]">SIMULADO</span> : p.provider}</td>
            <td className="p-3 font-mono text-xs">{p.providerPaymentId ?? "—"}</td>
            <td className="p-3">{PAYMENT_STATUS_LABEL[p.status]}</td>
            <td className="p-3">{formatBRL(p.amountCents)}</td>
            <td className="p-3">{formatBRL(p.platformFeeCents)}</td>
            <td className="p-3">{formatBRL(p.sellerAmountCents)}</td>
          </tr>
        ))}
      </AdminTable>
      <h2 className="text-lg font-bold">Webhooks recebidos</h2>
      <AdminTable head={["Recebido", "Provedor", "Evento", "Recurso", "Tipo", "Situação", "Erro"]}>
        {webhooks.map((w) => (
          <tr key={w.id}>
            <td className="p-3">{w.receivedAt.toLocaleString("pt-BR")}</td>
            <td className="p-3">{w.provider}</td>
            <td className="p-3 font-mono text-xs">{w.eventKey.slice(0, 24)}</td>
            <td className="p-3 font-mono text-xs">{w.resourceId?.slice(0, 16)}</td>
            <td className="p-3">{w.type ?? "—"}</td>
            <td className="p-3">{w.status}</td>
            <td className="max-w-56 truncate p-3 text-xs text-danger">{w.error}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
