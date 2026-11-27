import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getEmailProvider } from "@/services/email";
import { notificationEmail } from "@/services/email/templates";

/**
 * Notificação interna (sininho) e, para eventos importantes, e-mail transacional.
 * Nunca derruba o fluxo principal: falhas são apenas registradas.
 */
export async function notify(userId: string, title: string, message: string, link?: string, opts: { email?: boolean } = { email: true }) {
  try {
    await prisma.notification.create({ data: { userId, title, message, link } });
  } catch (error) {
    logger.error("notify.failed", { error: String(error) });
  }
  if (!opts.email) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, status: true } });
    if (!user || user.status !== "ACTIVE") return;
    await getEmailProvider().send({ to: user.email, ...notificationEmail(user.name, title, message, link) });
  } catch (error) {
    logger.error("notify.email_failed", { error: String(error) });
  }
}
