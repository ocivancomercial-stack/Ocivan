import { AdminForm } from "@/features/admin/ui";
import { adminCategoryAction } from "@/features/admin/actions";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Categorias" };

export default async function AdminCategories() {
  await requireAdmin();
  const roots = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { position: "asc" },
    include: { children: { orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Categorias</h1>
      <p className="text-sm text-muted">A v1 aceita apenas Roupas, Tênis, Sapatos e Bolsas. É possível criar e desativar subcategorias.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {roots.map((r) => (
          <Card key={r.id} className="space-y-3 p-4">
            <h2 className="font-bold">{r.name}</h2>
            <ul className="divide-y divide-line text-sm">
              {r.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span className={c.active ? "" : "text-muted line-through"}>{c.name} <span className="text-xs text-muted">({c._count.products})</span></span>
                  <AdminForm action={adminCategoryAction} fields={{ op: "toggle", id: c.id }} label={c.active ? "Desativar" : "Ativar"} variant="ghost" />
                </li>
              ))}
            </ul>
            <AdminForm action={adminCategoryAction} fields={{ op: "create", parentId: r.id }} label="Adicionar" className="flex items-center gap-2">
              <input name="name" placeholder="Nova subcategoria" maxLength={50} className="h-9 flex-1 rounded-field border border-line px-3 text-sm" />
            </AdminForm>
          </Card>
        ))}
      </div>
    </div>
  );
}
