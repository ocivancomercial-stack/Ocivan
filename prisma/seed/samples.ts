import type { PrismaClient } from "@prisma/client";

/**
 * Dados de DEMONSTRAÇÃO (fictícios). Implementados na Etapa 3 (anúncios de exemplo).
 * Todos os registros serão marcados com isSample=true e exibidos com o selo "Exemplo".
 */
export async function seedSamples(prisma: PrismaClient) {
  void prisma;
  console.log("ℹ Anúncios de exemplo: serão adicionados na Etapa 3.");
}
