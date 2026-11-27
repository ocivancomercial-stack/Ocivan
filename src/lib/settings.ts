import { prisma } from "@/lib/db";

/** Configurações da plataforma com valores padrão seguros (editáveis no admin — Etapa 4). */
const DEFAULTS = {
  platform_fee_bps: 1200,
  reservation_minutes: 15,
  listing_moderation: "auto" as "auto" | "manual",
  max_images_per_product: 8,
};
type Settings = typeof DEFAULTS;

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (row === null) return DEFAULTS[key];
  const value = row.value as unknown;
  return (typeof value === typeof DEFAULTS[key] ? value : DEFAULTS[key]) as Settings[K];
}
