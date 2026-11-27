import { distanceKm, findCity, SERVED_CITIES } from "@/lib/regions";

/**
 * Converte o texto digitado em uma tsquery segura com prefixo:
 * "Jaqueta  jeans!" → "jaqueta:* & jeans:*". Só letras/dígitos chegam ao banco.
 */
export function buildTsQuery(q: string | undefined): string | null {
  if (!q) return null;
  const tokens = q
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(" & ") : null;
}

/** Municípios atendidos dentro do raio (km) a partir do centro da cidade de origem. */
export function citiesWithin(origin: string, km: number): string[] {
  const from = findCity(origin);
  if (!from) return [];
  return SERVED_CITIES.filter((c) => distanceKm(from, c) <= km).map((c) => c.name);
}

/** Converte reais (filtro da URL) em centavos. */
export const reaisToCents = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 100));
