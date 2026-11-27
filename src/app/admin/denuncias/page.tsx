import Link from "next/link";
import { AdminForm } from "@/features/admin/ui";
import { AdminTable } from "@/features/admin/table";
import { adminReportAction } from "@/features/admin/actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Denúncias" };

export default async function AdminReports() {
  await requireAdmin();
  const reports = await prisma.report.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { product: { select: { id: true, title: true, status: true } }, reporter: { select: { email: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Denúncias</h1>
      <AdminTable head={["Data", "Anúncio", "Motivo", "Detalhes", "Denunciante", "Situação", "Ações"]}>
        {reports.map((r) => (
          <tr key={r.id}>
            <td className="p-3">{r.createdAt.toLocaleDateString("pt-BR")}</td>
            <td className="p-3"><Link href={`/produto/${r.product.id}`} className="text-brand hover:underline">{r.product.title}</Link> <span className="text-xs text-muted">({r.product.status})</span></td>
            <td className="p-3">{r.reason}</td>
            <td className="max-w-56 p-3 text-xs">{r.description ?? "—"}</td>
            <td className="p-3">{r.reporter.email}</td>
            <td className="p-3">{r.status}</td>
            <td className="p-3">
              {["OPEN", "UNDER_REVIEW"].includes(r.status) && (
                <div className="flex flex-wrap gap-2">
                  <AdminForm action={adminReportAction} fields={{ reportId: r.id, outcome: "RESOLVED" }} label="Procedente">
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="remove" defaultChecked /> remover anúncio</label>
                  </AdminForm>
                  <AdminForm action={adminReportAction} fields={{ reportId: r.id, outcome: "DISMISSED" }} label="Improcedente" variant="ghost" />
                </div>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
