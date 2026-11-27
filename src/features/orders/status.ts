import type { OrderStatus } from "@prisma/client";

/** Transições permitidas do pedido. Qualquer outra é recusada. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["SHIPPED", "CANCELED", "REFUNDED", "DISPUTED"],
  SHIPPED: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "DISPUTED"],
  COMPLETED: [],
  CANCELED: ["REFUNDED"],
  REFUNDED: [],
  DISPUTED: ["COMPLETED", "REFUNDED"],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago — aguardando envio",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
  DISPUTED: "Em disputa",
};

export const PAYMENT_STATUS_LABEL = {
  PENDING: "Pendente",
  AUTHORIZED: "Autorizado",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
  CHARGED_BACK: "Estornado (chargeback)",
  IN_MEDIATION: "Em mediação",
} as const;
