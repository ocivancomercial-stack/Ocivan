/**
 * Municípios atendidos na fase 1: Curitiba e Região Metropolitana (PR).
 * Coordenadas APROXIMADAS do centro de cada município — usadas apenas para
 * estimar distância entre comprador e anúncio, sem expor endereços.
 */
export type City = { name: string; state: "PR"; lat: number; lng: number };

export const SERVED_CITIES: readonly City[] = [
  { name: "Curitiba", state: "PR", lat: -25.4284, lng: -49.2733 },
  { name: "São José dos Pinhais", state: "PR", lat: -25.5347, lng: -49.2064 },
  { name: "Colombo", state: "PR", lat: -25.2925, lng: -49.2262 },
  { name: "Araucária", state: "PR", lat: -25.5859, lng: -49.4047 },
  { name: "Pinhais", state: "PR", lat: -25.4447, lng: -49.1925 },
  { name: "Campo Largo", state: "PR", lat: -25.4586, lng: -49.5277 },
  { name: "Almirante Tamandaré", state: "PR", lat: -25.3247, lng: -49.3103 },
  { name: "Piraquara", state: "PR", lat: -25.4422, lng: -49.0625 },
  { name: "Fazenda Rio Grande", state: "PR", lat: -25.6624, lng: -49.3073 },
  { name: "Campina Grande do Sul", state: "PR", lat: -25.3044, lng: -49.0551 },
  { name: "Quatro Barras", state: "PR", lat: -25.3659, lng: -49.0763 },
  { name: "Campo Magro", state: "PR", lat: -25.3687, lng: -49.4501 },
  { name: "Rio Branco do Sul", state: "PR", lat: -25.1902, lng: -49.3141 },
  { name: "Mandirituba", state: "PR", lat: -25.777, lng: -49.3258 },
  { name: "Itaperuçu", state: "PR", lat: -25.2193, lng: -49.3478 },
  { name: "Balsa Nova", state: "PR", lat: -25.5804, lng: -49.6323 },
  { name: "Contenda", state: "PR", lat: -25.6788, lng: -49.535 },
  { name: "Bocaiúva do Sul", state: "PR", lat: -25.2066, lng: -49.1141 },
  { name: "Lapa", state: "PR", lat: -25.7671, lng: -49.7168 },
  { name: "Quitandinha", state: "PR", lat: -25.8734, lng: -49.4973 },
  { name: "Tijucas do Sul", state: "PR", lat: -25.9311, lng: -49.195 },
  { name: "Agudos do Sul", state: "PR", lat: -25.9899, lng: -49.3343 },
  { name: "Campo do Tenente", state: "PR", lat: -25.98, lng: -49.6844 },
  { name: "Piên", state: "PR", lat: -26.0965, lng: -49.4336 },
  { name: "Rio Negro", state: "PR", lat: -26.1, lng: -49.7975 },
  { name: "Adrianópolis", state: "PR", lat: -24.6606, lng: -48.9922 },
  { name: "Cerro Azul", state: "PR", lat: -24.8236, lng: -49.2614 },
  { name: "Doutor Ulysses", state: "PR", lat: -24.5665, lng: -49.4219 },
  { name: "Tunas do Paraná", state: "PR", lat: -24.9731, lng: -49.0879 },
];

export const SERVED_CITY_NAMES = SERVED_CITIES.map((c) => c.name) as [string, ...string[]];

export function findCity(name: string | null | undefined): City | undefined {
  return SERVED_CITIES.find((c) => c.name === name);
}

/** Distância aproximada em km (fórmula de Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
