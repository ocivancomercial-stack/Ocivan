"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { mocksEnabled } from "./common";
import { mpSimulatePayment } from "./mercadopago";
import { meAdvance } from "./melhorenvio";

/** Tela simulada do Mercado Pago: o "comprador" escolhe o resultado do pagamento. */
export async function mpPayAction(formData: FormData) {
  if (!mocksEnabled()) throw new Error("Simulador desativado");
  const outcome = String(formData.get("outcome"));
  if (!["approved", "pending", "rejected"].includes(outcome)) return;
  const res = await mpSimulatePayment(String(formData.get("preferenceId")), outcome as "approved" | "pending" | "rejected");
  redirect(res.redirect ?? "/perfil/compras");
}

/** Simula a transportadora avançando o envio (postado → entregue). Apenas vendedor do pedido ou admin. */
export async function meAdvanceAction(formData: FormData) {
  if (!mocksEnabled()) throw new Error("Simulador desativado");
  const user = await getCurrentUser();
  const shipment = await prisma.shipment.findUnique({ where: { id: String(formData.get("shipmentId")) }, include: { order: true } });
  if (!user || !shipment?.providerShipmentId || (shipment.order.sellerId !== user.id && user.role !== "ADMIN")) return;
  await meAdvance(shipment.providerShipmentId);
  revalidatePath(`/pedidos/${shipment.orderId}`);
}
