import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { getCart } from "@/features/cart/service";
import { CheckoutForm } from "@/features/orders/components/checkout-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ vendedor?: string }> }) {
  const { vendedor } = await searchParams;
  const user = await requireUser(`/checkout${vendedor ? `?vendedor=${vendedor}` : ""}`);
  const group = (await getCart(user.id)).find((g) => g.sellerId === vendedor);
  if (!group) redirect("/carrinho");
  const [addresses, minutes] = await Promise.all([
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    getSetting("reservation_minutes"),
  ]);
  const subtotal = group.items.reduce((s, i) => s + i.product.priceCents, 0);
  const unavailable = group.items.some((i) => i.product.status !== "ACTIVE");

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold">Finalizar compra</h1>
        {unavailable ? (
          <Alert tone="error">Há itens indisponíveis. <Link href="/carrinho" className="font-semibold underline">Voltar ao carrinho</Link></Alert>
        ) : addresses.length === 0 ? (
          <Alert tone="warning">Cadastre um endereço de entrega para continuar. <Link href="/perfil#enderecos" className="font-semibold underline">Adicionar endereço</Link></Alert>
        ) : (
          <CheckoutForm
            sellerId={group.sellerId}
            subtotalCents={subtotal}
            reservationMinutes={minutes}
            addresses={addresses.map((a) => ({ id: a.id, label: `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""} · ${a.neighborhood}, ${a.city}/${a.state} · CEP ${a.postalCode.replace(/(\d{5})(\d{3})/, "$1-$2")}` }))}
          />
        )}
      </div>
      <aside className="space-y-3">
        <h2 className="font-bold">Itens ({group.items.length})</h2>
        <ul className="space-y-3">
          {group.items.map(({ product: p }) => (
            <li key={p.id} className="flex gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-field bg-brand-50">
                {p.images[0] && <Image src={p.images[0].imageUrl} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold">{p.title}</p>
                <p>{formatBRL(p.priceCents)}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
