import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Notificações", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requireUser("/perfil/notificacoes");
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  // Abrir a página marca como lidas.
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-extrabold">Notificações</h1>
      {items.length === 0 && <p className="text-sm text-muted">Nada por aqui ainda.</p>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`rounded-card p-4 shadow-card ${n.readAt ? "bg-surface" : "bg-brand-50"}`}>
            <p className="font-semibold">{n.title}</p>
            <p className="text-sm text-ink/80">{n.message}</p>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{n.createdAt.toLocaleString("pt-BR")}</span>
              {n.link?.startsWith("/") && <Link href={n.link} className="font-semibold text-brand">Ver</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
