import { distanceKm, findCity } from "@/lib/regions";

/** Erro de frete com mensagem segura para exibir ao usuário. */
export class ShippingError extends Error {}

export type PackageItem = { id: string; name: string; widthCm: number; heightCm: number; lengthCm: number; weightGrams: number; valueCents: number };

export type ShippingQuoteInput = {
  fromCity: string;
  fromPostalCode?: string; // CEP de origem (endereço do vendedor) — obrigatório nos provedores reais
  toPostalCode: string;
  toCity: string;
  weightGrams: number;
  allowsLocalPickup: boolean;
  packages: PackageItem[];
};

export type ShippingOption = {
  id: string;
  name: string;
  priceCents: number;
  estimatedDays: number;
  isSimulated: boolean;
  kind: "carrier" | "local";
};

export type LabelParty = {
  name: string; phone?: string | null; email?: string | null; document: string;
  address: string; number: string; complement?: string | null; district: string; city: string; stateAbbr: string; postalCode: string;
};

export type LabelInput = {
  orderCode: string;
  serviceId: string; // id da opção cotada
  from: LabelParty;
  to: LabelParty;
  packages: PackageItem[];
};

export type LabelResult = { providerShipmentId: string; protocol?: string; labelUrl: string; trackingCode?: string | null; isSimulated: boolean };
export type TrackingInfo = { status: string; trackingCode?: string | null };
export type ShippingWebhookEvent = { eventKey: string; providerShipmentId: string; status: string; trackingCode?: string | null };

export interface ShippingProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  /** true se o provedor gera etiquetas (senão o vendedor informa o rastreio manualmente). */
  readonly supportsLabels: boolean;
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
  createLabel?(input: LabelInput): Promise<LabelResult>;
  track?(providerShipmentIds: string[]): Promise<Record<string, TrackingInfo>>;
  cancelLabel?(providerShipmentId: string, reason: string): Promise<{ ok: boolean }>;
  verifyWebhook?(req: { headers: Headers; body: string }): ShippingWebhookEvent | null;
}

/** Dimensões padrão por categoria (cm) — usadas para cotar quando o anúncio não informa medidas. */
export const DEFAULT_DIMENSIONS: Record<string, { widthCm: number; heightCm: number; lengthCm: number }> = {
  roupas: { widthCm: 25, heightCm: 5, lengthCm: 30 },
  tenis: { widthCm: 22, heightCm: 13, lengthCm: 33 },
  sapatos: { widthCm: 20, heightCm: 12, lengthCm: 30 },
  bolsas: { widthCm: 30, heightCm: 15, lengthCm: 40 },
};

/**
 * Frete SIMULADO para desenvolvimento/homologação. Valores fictícios, claramente marcados.
 * Nunca usado em produção (src/lib/env.ts).
 */
export class SimulatedShippingProvider implements ShippingProvider {
  readonly name = "simulated";
  readonly isSimulated = true;
  readonly supportsLabels = false;

  async quote(input: ShippingQuoteInput): Promise<ShippingOption[]> {
    if (!/^\d{8}$/.test(input.toPostalCode)) throw new Error("CEP inválido");
    const from = findCity(input.fromCity);
    const to = findCity(input.toCity);
    const km = from && to ? distanceKm(from, to) : 400;
    const kg = Math.max(1, Math.ceil(input.weightGrams / 1000));
    const options: ShippingOption[] = [
      { id: "sim-economico", name: "Econômico (simulado)", priceCents: 1490 + Math.round(km * 4) + (kg - 1) * 300, estimatedDays: km < 80 ? 3 : 7, isSimulated: true, kind: "carrier" },
      { id: "sim-expresso", name: "Expresso (simulado)", priceCents: 2490 + Math.round(km * 7) + (kg - 1) * 500, estimatedDays: km < 80 ? 1 : 3, isSimulated: true, kind: "carrier" },
    ];
    if (input.allowsLocalPickup && to) options.unshift(localPickupOption());
    return options;
  }
}

export function localPickupOption(): ShippingOption {
  return { id: "local-pickup", name: "Entrega/retirada combinada na cidade", priceCents: 0, estimatedDays: 2, isSimulated: false, kind: "local" };
}

let provider: ShippingProvider | undefined;
export function getShippingProvider(): ShippingProvider {
  if (provider) return provider;
  if (process.env.SHIPPING_PROVIDER === "melhorenvio") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MelhorEnvioProvider } = require("./melhorenvio") as typeof import("./melhorenvio");
    const me = MelhorEnvioProvider.fromEnv();
    provider = me;
    return me;
  }
  if (process.env.APP_ENV === "production") throw new Error("Frete simulado é proibido em produção");
  provider = new SimulatedShippingProvider();
  return provider;
}
export function setShippingProvider(p: ShippingProvider) {
  provider = p;
}
