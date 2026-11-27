import { AdminForm } from "@/features/admin/ui";
import { AdminTable } from "@/features/admin/table";
import { adminCouponAction } from "@/features/admin/actions";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata = { title: "Cupons" };
const input = "h-9 rounded-field border border-line px-3 text-sm";

export default async function AdminCoupons() {
  await requireAdmin();
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Cupons</h1>
      <Card className="p-4">
        <AdminForm action={adminCouponAction} fields={{ op: "create" }} label="Criar cupom" variant="primary" className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <input name="code" placeholder="CODIGO" className={`${input} uppercase`} required />
          <select name="discountType" className={input}><option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option></select>
          <input name="value" type="number" step="0.01" placeholder="Valor" className={input} required />
          <input name="minOrder" type="number" step="0.01" placeholder="Pedido mínimo R$" className={input} />
          <input name="maxUses" type="number" placeholder="Usos máx." className={input} />
          <input name="expiresAt" type="date" className={input} />
        </AdminForm>
        <p className="mt-2 text-xs text-muted">O desconto é custeado pela plataforma e limitado à comissão do pedido — nunca reduz o valor do vendedor.</p>
      </Card>
      <AdminTable head={["Código", "Desconto", "Mínimo", "Usos", "Validade", "Situação", ""]}>
        {coupons.map((c) => (
          <tr key={c.id}>
            <td className="p-3 font-mono font-semibold">{c.code}</td>
            <td className="p-3">{c.discountType === "PERCENT" ? `${c.discountValue / 100}%` : formatBRL(c.discountValue)}</td>
            <td className="p-3">{formatBRL(c.minOrderCents)}</td>
            <td className="p-3">{c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""}</td>
            <td className="p-3">{c.expiresAt?.toLocaleDateString("pt-BR") ?? "—"}</td>
            <td className="p-3">{c.active ? "Ativo" : "Inativo"}</td>
            <td className="p-3"><AdminForm action={adminCouponAction} fields={{ op: "toggle", id: c.id }} label={c.active ? "Desativar" : "Ativar"} variant="ghost" /></td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
