import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Usuário da sessão atual (memoizado por requisição). Sempre revalida no banco. */
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true, avatar: true, phone: true, city: true, state: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Exige usuário autenticado; redireciona para o login preservando o destino. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Exige papel ADMIN. Para não revelar a existência do painel, usuários comuns recebem 404. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") notFound();
  return user;
}

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}
