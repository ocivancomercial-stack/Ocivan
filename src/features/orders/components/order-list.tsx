import Image from "next/image";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { formatBRL } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "../status";

type Row = { id: string; code: string; status: OrderStatus; totalCents: number; createdAt: Date; items: { productTitleSnapshot: string; productImageSnapshot: string | null }[] };

export function OrderList({ orders, empty }: { orders: Row[]; empty: React.ReactNode }) {
  if (orders.length === 0) return <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">{empty}</div>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/pedidos/${o.id}`} className="flex gap-3 rounded-card bg-surface p-3 shadow-card hover:ring-2 hover:ring-brand-100">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-field bg-brand-50">
              {o.items[0]?.productImageSnapshot && <Image src={o.items[0].productImageSnapshot} alt="" fill sizes="64px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex justify-between gap-2">
                <p className="truncate font-semibold">{o.items[0]?.productTitleSnapshot}{o.items.length > 1 ? ` +${o.items.length - 1}` : ""}</p>
                <p className="shrink-0 font-extrabold">{formatBRL(o.totalCents)}</p>
              </div>
              <p className="text-xs text-muted">{o.code} · {o.createdAt.toLocaleDateString("pt-BR")}</p>
              <p className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900">{ORDER_STATUS_LABEL[o.status]}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
