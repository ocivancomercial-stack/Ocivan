"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { ShippingOption } from "@/services/shipping";
import { cancelOrderByBuyer, confirmReceipt, createOrderFromCart, createReview, generateLabel, markShipped, openDispute, OrderError, quoteShipping, refreshTracking } from "./service";
import { startPayment } from "@/features/payments/service";

type Result = { ok: boolean; message?: string };

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof OrderError) return e.message;
  logger.error("order.action_failed", { error: String(e) });
  return fallback;
}

export async function quoteShippingAction(sellerId: string, addressId: string): Promise<{ ok: true; options: ShippingOption[] } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre novamente." };
  try {
    return { ok: true, options: await quoteShipping(user.id, String(sellerId), String(addressId)) };
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Não foi possível calcular o frete.") };
  }
}

export async function placeOrderAction(_prev: Result, formData: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre novamente." };
  if (!(await rateLimit(`order:${user.id}`, { max: 10, windowSeconds: 600 })).allowed) return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." };
  let orderId: string;
  try {
    const order = await createOrderFromCart(user.id, {
      sellerId: String(formData.get("sellerId") ?? ""),
      addressId: String(formData.get("addressId") ?? ""),
      shippingOptionId: String(formData.get("shippingOptionId") ?? ""),
      couponCode: String(formData.get("couponCode") ?? "").trim() || undefined,
      cpf: String(formData.get("cpf") ?? "") || undefined,
    });
    orderId = order.id;
  } catch (e) {
    return { ok: false, message: errorMessage(e, "Não foi possível criar o pedido.") };
  }
  redirect(`/pedidos/${orderId}`);
}

export async function startPaymentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const orderId = String(formData.get("orderId"));
  const session = await startPayment(user.id, orderId).catch((e) => {
    logger.warn("payment.start_failed", { error: String(e) });
    return null;
  });
  if (session?.kind === "redirect") redirect(session.url);
  revalidatePath(`/pedidos/${orderId}`);
}

async function run(fn: (userId: string) => Promise<unknown>, orderId: string, fallback: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre novamente." };
  try {
    await fn(user.id);
  } catch (e) {
    return { ok: false, message: errorMessage(e, fallback) };
  }
  revalidatePath(`/pedidos/${orderId}`);
  return { ok: true };
}

export async function orderAction(_prev: Result, formData: FormData): Promise<Result> {
  const orderId = String(formData.get("orderId"));
  switch (String(formData.get("action"))) {
    case "cancel":
      return run((u) => cancelOrderByBuyer(u, orderId), orderId, "Não foi possível cancelar.");
    case "ship":
      return run((u) => markShipped(u, orderId, String(formData.get("trackingCode") ?? "")), orderId, "Não foi possível registrar o envio.");
    case "receive":
      return run((u) => confirmReceipt(u, orderId), orderId, "Não foi possível confirmar.");
    case "dispute":
      return run((u) => openDispute(u, orderId, String(formData.get("reason") ?? "")), orderId, "Não foi possível abrir a disputa.");
    case "label":
      return run((u) => generateLabel(u, orderId), orderId, "Não foi possível gerar a etiqueta.");
    case "track":
      return run((u) => refreshTracking(u, orderId), orderId, "Não foi possível consultar o rastreio.");
    case "review":
      return run((u) => createReview(u, orderId, Number(formData.get("rating")), String(formData.get("comment") ?? "")), orderId, "Não foi possível avaliar.");
    default:
      return { ok: false, message: "Ação inválida." };
  }
}
