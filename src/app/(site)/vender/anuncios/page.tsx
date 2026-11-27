import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ProductStatus } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { STATUS_LABEL } from "@/features/products/constants";
import { ListingActions } from "@/features/products/listing-actions";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { VerifyEmailBanner } from "@/features/auth/verify-email-banner";
import { cn, formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Meus anúncios", robots: { index: false } };

const TABS: { key: string; label: string; statuses: ProductStatus[] }[] = [
  { key: "ativos", label: "Ativos", statuses: ["ACTIVE", "IN_REVIEW", "RESERVED"] },
  { key: "pausados", label: "Pausados e rascunhos", statuses: ["PAUSED", "DRAFT"] },
  { key: "vendidos", label: "Vendidos", statuses: ["SOLD"] },
];

const STATUS_STYLE: Partial<Record<ProductStatus, string>> = {
  ACTIVE: "bg-brand-50 text-brand-900",
  IN_REVIEW: "bg-accent-50 text-[#7a5410]",
  RESERVED: "bg-accent-50 text-[#7a5410]",
  SOLD: "bg-ink text-white",
};

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("/vender/anuncios");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.aba) ?? TABS[0];

  const [products, counts] = await Promise.all([
    prisma.product.findMany({
      where: { sellerId: user.id, status: { in: tab.statuses } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, priceCents: true, status: true, isSample: true, updatedAt: true, images: { take: 1, orderBy: { position: "asc" }, select: { imageUrl: true } }, _count: { select: { favorites: true } } },
    }),
    prisma.product.groupBy({ by: ["status"], where: { sellerId: user.id }, _count: true }),
  ]);
  const countFor = (statuses: ProductStatus[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

  const savedMessage =
    sp.salvo && (sp.status === "ACTIVE" ? "Anúncio publicado! Ele já aparece nas buscas." : sp.status === "IN_REVIEW" ? "Anúncio enviado para revisão. Avisaremos quando for aprovado." : sp.status === "DRAFT" ? "Rascunho salvo." : "Alterações salvas.");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Meus anúncios</h1>
        <ButtonLink href="/vender" size="sm"><Plus className="size-4" /> Novo</ButtonLink>
      </div>
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
      {savedMessage && (
        <Alert tone="success">
          {savedMessage} {sp.status === "ACTIVE" && <Link href={`/produto/${sp.salvo}`} className="font-semibold underline">Ver anúncio</Link>}
        </Alert>
      )}
      <nav className="flex gap-2 overflow-x-auto" aria-label="Filtrar anúncios">
        {TABS.map((t) => (
          <Link key={t.key} href={`/vender/anuncios?aba=${t.key}`} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold", t.key === tab.key ? "bg-brand text-white" : "bg-surface text-ink shadow-card")}>
            {t.label} ({countFor(t.statuses)})
          </Link>
        ))}
      </nav>
      {products.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          Nenhum anúncio aqui. <Link href="/vender" className="font-semibold text-brand">Criar anúncio</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id} className="flex gap-4 rounded-card bg-surface p-3 shadow-card">
              <Link href={`/produto/${p.id}`} className="relative size-24 shrink-0 overflow-hidden rounded-field bg-brand-50">
                {p.images[0] && <Image src={p.images[0].imageUrl} alt="" fill sizes="96px" className="object-cover" />}
              </Link>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="text-sm font-extrabold">{formatBRL(p.priceCents)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[p.status] ?? "bg-line text-ink")}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="text-xs text-muted">{p._count.favorites} favoritos · atualizado em {p.updatedAt.toLocaleDateString("pt-BR")}</p>
                <ListingActions productId={p.id} status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
