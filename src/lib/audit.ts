import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Registra operação sensível na trilha de auditoria. Nunca lança — auditoria não deve derrubar o fluxo. */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}) {
  try {
    await prisma.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null } });
  } catch (error) {
    logger.error("audit.write_failed", { action: entry.action, error: String(error) });
  }
}
