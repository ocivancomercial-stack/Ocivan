import { AdminForm } from "@/features/admin/ui";
import { adminSettingsAction } from "@/features/admin/actions";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Configurações" };
const input = "h-10 w-full rounded-field border border-line px-3 text-sm";

export default async function AdminSettings() {
  await requireAdmin();
  const [fee, minutes, moderation, history] = await Promise.all([
    getSetting("platform_fee_bps"),
    getSetting("reservation_minutes"),
    getSetting("listing_moderation"),
    prisma.auditLog.findMany({ where: { action: "admin.settings.update" }, orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { email: true } } } }),
  ]);
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-extrabold">Configurações</h1>
      <Card className="p-5">
        <AdminForm action={adminSettingsAction} label="Salvar" variant="primary" className="space-y-4">
          <label className="block text-sm font-semibold">Comissão da plataforma (%)
            <input name="feePercent" type="number" step="0.1" min={0} max={30} defaultValue={fee / 100} className={input} />
            <span className="text-xs font-normal text-muted">Aplica-se a pedidos novos. Pedidos existentes mantêm a taxa registrada.</span>
          </label>
          <label className="block text-sm font-semibold">Reserva no checkout (minutos)
            <input name="reservationMinutes" type="number" min={5} max={120} defaultValue={minutes} className={input} />
          </label>
          <label className="block text-sm font-semibold">Moderação de anúncios
            <select name="moderation" defaultValue={moderation} className={input}>
              <option value="auto">Automática (publica direto)</option>
              <option value="manual">Manual (revisão antes de publicar)</option>
            </select>
          </label>
        </AdminForm>
      </Card>
      <section className="space-y-2">
        <h2 className="font-bold">Histórico de alterações</h2>
        <ul className="space-y-1 text-xs text-muted">
          {history.map((h) => <li key={h.id}>{h.createdAt.toLocaleString("pt-BR")} — {h.actor?.email ?? "sistema"}: {JSON.stringify((h.metadata as { after?: unknown })?.after)}</li>)}
        </ul>
      </section>
    </div>
  );
}
