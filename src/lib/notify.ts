import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Notificação interna (sininho). E-mail transacional entra na Etapa 6. Nunca derruba o fluxo. */
export async function notify(userId: string, title: string, message: string, link?: string) {
  try {
    await prisma.notification.create({ data: { userId, title, message, link } });
  } catch (error) {
    logger.error("notify.failed", { error: String(error) });
  }
}
