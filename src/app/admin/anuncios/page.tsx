import Link from "next/link";
import type { ProductStatus } from "@prisma/client";
import { AdminForm } from "@/features/admin/ui";
import { AdminSearch, AdminTable } from "@/features/admin/table";
import { adminProductAction } from "@/features/admin/actions";
import { STATUS_LABEL } from "@/features/products/constants";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata = { title: "Anúncios" };
const STATUSES = Object.keys(STATUS_LABEL) as ProductStatus[];

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const st = STATUSES.includes(status as ProductStatus) ? (status as ProductStatus) : undefined;
  const [products, pending] = await Promise.all([
    prisma.product.findMany({
      where: { ...(st ? { status: st } : {}), ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, priceCents: true, status: true, isFeatured: true, isSample: true, city: true, seller: { select: { email: true } }, _count: { select: { reports: true } } },
    }),
    prisma.product.count({ where: { status: "IN_REVIEW" } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Anúncios</h1>
      {pending > 0 && <Link href="/admin/anuncios?status=IN_REVIEW" className="inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-brand-900">{pending} aguardando revisão</Link>}
      <AdminSearch placeholder="Título" defaultValue={q} extra={
        <select name="status" defaultValue={st ?? ""} className="h-10 rounded-field border border-line bg-surface px-3 text-sm">
          <option value="">Todas as situações</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      } />
      <AdminTable head={["Título", "Vendedor", "Preço", "Situação", "Denúncias", "Ações"]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="p-3"><Link href={`/produto/${p.id}`} className="font-semibold text-brand hover:underline">{p.title}</Link>{p.isSample && <span className="ml-1 text-xs text-[#7a5410]">(exemplo)</span>}{p.isFeatured && <span className="ml-1 text-xs">★</span>}</td>
            <td className="p-3">{p.seller.email}</td>
            <td className="p-3">{formatBRL(p.priceCents)}</td>
            <td className="p-3">{STATUS_LABEL[p.status]}</td>
            <td className="p-3">{p._count.reports}</td>
            <td className="flex flex-wrap gap-1 p-3">
              {p.status === "IN_REVIEW" && <>
                <AdminForm action={adminProductAction} fields={{ productId: p.id, action: "approve" }} label="Aprovar" variant="primary" />
                <AdminForm action={adminProductAction} fields={{ productId: p.id, action: "reject" }} label="Devolver" />
              </>}
              {p.status === "ACTIVE" && <AdminForm action={adminProductAction} fields={{ productId: p.id, action: p.isFeatured ? "unfeature" : "feature" }} label={p.isFeatured ? "Tirar destaque" : "Destacar"} />}
              {["DRAFT", "IN_REVIEW", "ACTIVE", "PAUSED"].includes(p.status) && <AdminForm action={adminProductAction} fields={{ productId: p.id, action: "remove" }} label="Remover" variant="danger" confirmText="Remover este anúncio? O vendedor será notificado." />}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
