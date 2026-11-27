import { distanceKm, findCity } from "@/lib/regions";

export type ShippingQuoteInput = {
  fromCity: string; // cidade do vendedor/anúncio
  toPostalCode: string;
  toCity: string;
  weightGrams: number;
  allowsLocalPickup: boolean;
};

export type ShippingOption = {
  id: string;
  name: string;
  priceCents: number;
  estimatedDays: number;
  isSimulated: boolean;
  kind: "carrier" | "local";
};

export interface ShippingProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  quote(input: ShippingQuoteInput): Promise<ShippingOption[]>;
}

/**
 * Frete SIMULADO para desenvolvimento/homologação. Valores fictícios, claramente marcados.
 * Nunca usado em produção (src/lib/env.ts). Integração real (Melhor Envio): Etapa 5.
 */
export class SimulatedShippingProvider implements ShippingProvider {
  readonly name = "simulated";
  readonly isSimulated = true;

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
    // Retirada/entrega combinada: só na Região Metropolitana e se o vendedor oferece.
    if (input.allowsLocalPickup && to) options.unshift({ id: "local-pickup", name: "Entrega/retirada combinada na cidade", priceCents: 0, estimatedDays: 2, isSimulated: false, kind: "local" });
    return options;
  }
}

let provider: ShippingProvider | undefined;
export function getShippingProvider(): ShippingProvider {
  if (provider) return provider;
  if (process.env.SHIPPING_PROVIDER === "melhorenvio") throw new Error("Melhor Envio: integração prevista para a Etapa 5");
  if (process.env.APP_ENV === "production") throw new Error("Frete simulado é proibido em produção");
  provider = new SimulatedShippingProvider();
  return provider;
}
export function setShippingProvider(p: ShippingProvider) {
  provider = p;
}
