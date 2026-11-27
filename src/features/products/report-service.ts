import { prisma } from "@/lib/db";
import { PUBLIC_STATUSES } from "./status";

/** Registra denúncia. Um usuário não pode denunciar o próprio anúncio nem abrir denúncias repetidas. */
export async function createReport(reporterId: string, input: { productId: string; reason: string; description?: string }) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, status: { in: PUBLIC_STATUSES } },
    select: { sellerId: true },
  });
  if (!product) return { ok: false as const, error: "Anúncio não encontrado" };
  if (product.sellerId === reporterId) return { ok: false as const, error: "Você não pode denunciar o próprio anúncio" };
  const open = await prisma.report.findFirst({ where: { reporterId, productId: input.productId, status: { in: ["OPEN", "UNDER_REVIEW"] } } });
  if (open) return { ok: true as const, duplicate: true };
  await prisma.report.create({ data: { reporterId, productId: input.productId, reason: input.reason, description: input.description } });
  return { ok: true as const, duplicate: false };
}
