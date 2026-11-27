import type { Metadata } from "next";
import Link from "next/link";
import { OrderList } from "@/features/orders/components/order-list";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Minhas compras", robots: { index: false } };

export default async function PurchasesPage() {
  const user = await requireUser("/perfil/compras");
  const orders = await prisma.order.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, code: true, status: true, totalCents: true, createdAt: true, items: { select: { productTitleSnapshot: true, productImageSnapshot: true } } },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-extrabold">Minhas compras</h1>
      <OrderList orders={orders} empty={<>Você ainda não comprou nada. <Link href="/explorar" className="font-semibold text-brand">Explorar</Link></>} />
    </div>
  );
}
