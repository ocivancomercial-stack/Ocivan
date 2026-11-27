/**
 * Seed do banco. Uso: `npm run db:seed`.
 *  - Sempre: categorias, subcategorias, marcas e configurações padrão (idempotente).
 *  - Somente fora de produção: dados de demonstração (marcados com isSample=true / e-mails @exemplo.repassaai.dev).
 *  - Administrador: apenas se SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD estiverem definidos (nada fixo no código).
 */
import { PrismaClient } from "@prisma/client";
import { BRANDS, CATEGORY_TREE, DEFAULT_SETTINGS } from "./catalog";
import { slugify } from "../../src/lib/utils";

const prisma = new PrismaClient();

async function seedCatalog() {
  for (const [i, cat] of CATEGORY_TREE.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, position: i, parentId: null },
      create: { name: cat.name, slug: cat.slug, position: i },
    });
    for (const [j, child] of cat.children.entries()) {
      const slug = `${cat.slug}-${slugify(child)}`;
      await prisma.category.upsert({
        where: { slug },
        update: { name: child, parentId: parent.id, position: j },
        create: { name: child, slug, parentId: parent.id, position: j },
      });
    }
  }
  for (const name of BRANDS) {
    await prisma.brand.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    // Não sobrescreve valores alterados pelo admin.
    await prisma.platformSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`✔ Catálogo: ${CATEGORY_TREE.length} categorias, ${BRANDS.length} marcas, configurações padrão`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("ℹ Admin não criado (defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD ou use `npm run admin:promote`).");
    return;
  }
  const { auth } = await import("../../src/lib/auth");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await auth.api.signUpEmail({
      body: { name: "Administrador Repassa", email, password, phone: "41999999999", city: "Curitiba", termsAccepted: true } as never,
    });
  }
  await prisma.user.update({ where: { email }, data: { role: "ADMIN", emailVerified: true } });
  console.log(`✔ Admin garantido: ${email}`);
}

async function main() {
  await seedCatalog();
  await seedAdmin();
  if (process.env.APP_ENV === "production") {
    console.log("ℹ APP_ENV=production: dados de demonstração NÃO foram inseridos.");
    return;
  }
  const { seedSamples } = await import("./samples");
  await seedSamples(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
