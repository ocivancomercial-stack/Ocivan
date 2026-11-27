import { AdminForm } from "@/features/admin/ui";
import { AdminTable } from "@/features/admin/table";
import { adminBrandAction } from "@/features/admin/actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Marcas" };

export default async function AdminBrands() {
  await requireAdmin();
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Marcas</h1>
      <AdminForm action={adminBrandAction} fields={{ op: "create" }} label="Adicionar marca" variant="primary" className="flex items-center gap-2">
        <input name="name" placeholder="Nome da marca" maxLength={50} className="h-9 w-64 rounded-field border border-line px-3 text-sm" />
      </AdminForm>
      <AdminTable head={["Marca", "Anúncios", "Situação", ""]}>
        {brands.map((b) => (
          <tr key={b.id}>
            <td className="p-3 font-semibold">{b.name}</td>
            <td className="p-3">{b._count.products}</td>
            <td className="p-3">{b.active ? "Ativa" : "Inativa"}</td>
            <td className="p-3"><AdminForm action={adminBrandAction} fields={{ op: "toggle", id: b.id }} label={b.active ? "Desativar" : "Ativar"} variant="ghost" /></td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
