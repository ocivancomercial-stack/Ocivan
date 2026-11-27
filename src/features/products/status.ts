import type { ProductStatus } from "@prisma/client";

/** Ações que o DONO do anúncio pode executar. */
export type OwnerAction = "publish" | "pause" | "reactivate" | "remove" | "edit";

const ALLOWED: Record<OwnerAction, ProductStatus[]> = {
  publish: ["DRAFT"],
  pause: ["ACTIVE"],
  reactivate: ["PAUSED"],
  remove: ["DRAFT", "IN_REVIEW", "ACTIVE", "PAUSED"], // reservado/vendido ficam para o histórico do pedido
  edit: ["DRAFT", "IN_REVIEW", "ACTIVE", "PAUSED"],
};

export function canOwner(action: OwnerAction, status: ProductStatus): boolean {
  return ALLOWED[action].includes(status);
}

/** Status resultante de uma ação do dono, considerando a moderação configurada. */
export function nextStatus(action: OwnerAction, current: ProductStatus, moderation: "auto" | "manual"): ProductStatus {
  if (!canOwner(action, current)) throw new Error(`Ação "${action}" não permitida para anúncio ${current}`);
  switch (action) {
    case "publish":
      return moderation === "manual" ? "IN_REVIEW" : "ACTIVE";
    case "pause":
      return "PAUSED";
    case "reactivate":
      return "ACTIVE";
    case "remove":
      return "REMOVED";
    case "edit":
      // Editar um anúncio ativo sob moderação manual exige nova revisão.
      return moderation === "manual" && current === "ACTIVE" ? "IN_REVIEW" : current;
  }
}

/** Status em que o anúncio é visível publicamente (página do produto). */
export const PUBLIC_STATUSES: ProductStatus[] = ["ACTIVE", "RESERVED", "SOLD"];
/** Status em que o anúncio aparece em buscas e vitrines. */
export const LISTED_STATUSES: ProductStatus[] = ["ACTIVE"];
