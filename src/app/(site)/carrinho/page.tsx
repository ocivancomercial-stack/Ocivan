import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { removeFromCartAction } from "@/features/cart/actions";
import { getCart } from "@/features/cart/service";
import { publicName } from "@/features/products/queries";
import { requireUser } from "@/lib/session";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function CartPage() {
  const user = await requireUser("/carrinho");
  const groups = await getCart(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-extrabold">Carrinho</h1>
      {groups.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          Seu carrinho está vazio. <Link href="/explorar" className="font-semibold text-brand">Explorar produtos</Link>
        </div>
      ) : (
        <>
          {groups.length > 1 && <p className="text-sm text-muted">Cada vendedor gera um pedido separado (envio e pagamento independentes).</p>}
          {groups.map((g) => {
            const available = g.items.filter((i) => i.product.status === "ACTIVE");
            const subtotal = available.reduce((s, i) => s + i.product.priceCents, 0);
            return (
              <Card key={g.sellerId} className="space-y-4 p-4">
                <p className="text-sm text-muted">Vendido por <strong className="text-ink">{publicName(g.sellerName)}</strong></p>
                <ul className="divide-y divide-line">
                  {g.items.map(({ product: p }) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <Link href={`/produto/${p.id}`} className="relative size-20 shrink-0 overflow-hidden rounded-field bg-brand-50">
                        {p.images[0] && <Image src={p.images[0].imageUrl} alt="" fill sizes="80px" className="object-cover" />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.title}</p>
                        <p className="text-xs text-muted">{[p.size && `Tam. ${p.size}`, p.city].filter(Boolean).join(" · ")}</p>
                        {p.status !== "ACTIVE" ? <p className="text-xs font-semibold text-danger">Indisponível ({p.status === "SOLD" ? "vendido" : "reservado"})</p> : <p className="font-extrabold">{formatBRL(p.priceCents)}</p>}
                      </div>
                      <form action={removeFromCartAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <Button variant="ghost" size="sm" aria-label="Remover"><Trash2 className="size-4" /></Button>
                      </form>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <div>
                    <p className="text-xs text-muted">Subtotal (sem frete)</p>
                    <p className="text-lg font-extrabold">{formatBRL(subtotal)}</p>
                  </div>
                  {available.length === g.items.length ? (
                    <ButtonLink href={`/checkout?vendedor=${g.sellerId}`}>Continuar</ButtonLink>
                  ) : (
                    <p className="max-w-40 text-right text-xs text-danger">Remova os itens indisponíveis para continuar.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
