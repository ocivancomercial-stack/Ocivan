"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { simulationAllowed } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { getPaymentProvider, SimulatedPaymentProvider } from "@/services/payments";
import { processPaymentNotification } from "./service";

/**
 * SOMENTE DESENVOLVIMENTO/HOMOLOGAÇÃO: muda o estado do pagamento "no provedor simulado"
 * e dispara a notificação pelo MESMO pipeline do webhook real (consulta ao provedor + idempotência).
 */
export async function simulatePaymentAction(formData: FormData) {
  if (!simulationAllowed()) throw new Error("Simulação indisponível em produção");
  const provider = getPaymentProvider();
  if (!(provider instanceof SimulatedPaymentProvider)) throw new Error("Provedor não é simulado");
  const user = await getCurrentUser();
  const paymentId = String(formData.get("paymentId"));
  const status = String(formData.get("status"));
  if (!user || !["APPROVED", "REJECTED", "PENDING"].includes(status)) return;
  const sp = await prisma.simulatedPayment.findUnique({ where: { id: paymentId } });
  const order = sp && (await prisma.order.findFirst({ where: { id: sp.externalRef, buyerId: user.id } }));
  if (!order) return;
  await provider.setStatus(paymentId, status as "APPROVED" | "REJECTED" | "PENDING");
  await processPaymentNotification(provider, { providerPaymentId: paymentId, eventKey: `sim-${randomUUID()}` }, { simulated: true, status });
  revalidatePath(`/pedidos/${order.id}`);
}
