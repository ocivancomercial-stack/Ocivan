import { AdminForm } from "@/features/admin/ui";
import { AdminSearch, AdminTable } from "@/features/admin/table";
import { adminUserAction } from "@/features/admin/actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Usuários" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  const { q } = await searchParams;
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true, city: true, role: true, status: true, createdAt: true, _count: { select: { products: true, purchases: true, sales: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Usuários</h1>
      <AdminSearch placeholder="Nome ou e-mail" defaultValue={q} />
      <AdminTable head={["Nome", "E-mail", "Cidade", "Papel", "Situação", "Anúncios", "Compras/Vendas", "Desde", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="p-3 font-semibold">{u.name}</td>
            <td className="p-3">{u.email}</td>
            <td className="p-3">{u.city ?? "—"}</td>
            <td className="p-3">{u.role}</td>
            <td className="p-3">{u.status}</td>
            <td className="p-3">{u._count.products}</td>
            <td className="p-3">{u._count.purchases}/{u._count.sales}</td>
            <td className="p-3">{u.createdAt.toLocaleDateString("pt-BR")}</td>
            <td className="p-3">
              {u.id !== admin.id && (u.status === "ACTIVE"
                ? <AdminForm action={adminUserAction} fields={{ userId: u.id, status: "SUSPENDED" }} label="Suspender" variant="danger" confirmText={`Suspender ${u.email}? As sessões serão encerradas e os anúncios pausados.`} />
                : <AdminForm action={adminUserAction} fields={{ userId: u.id, status: "ACTIVE" }} label="Reativar" />)}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
