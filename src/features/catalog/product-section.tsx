import Link from "next/link";
import { prisma } from "@/lib/db";

/**
 * Seções de produtos da vitrine. Na Etapa 2 apenas consulta a contagem real de anúncios ativos;
 * os cards de produto (fotos, preço, favoritos) são implementados na Etapa 3.
 */
export async function ProductSection({ title, kind }: { title: string; kind: "featured" | "recent" }) {
  const count = await prisma.product.count({ where: { status: "ACTIVE", ...(kind === "featured" ? { isFeatured: true } : {}) } });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-extrabold md:text-2xl">{title}</h2>
        <Link href="/explorar" className="text-sm font-semibold text-brand hover:underline">
          Ver tudo
        </Link>
      </div>
      {count === 0 && (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          Ainda não há anúncios publicados aqui. <Link href="/vender" className="font-semibold text-brand">Seja o primeiro a anunciar.</Link>
        </div>
      )}
    </section>
  );
}
