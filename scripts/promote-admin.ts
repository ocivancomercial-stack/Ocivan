/** Promove um usuário existente a ADMIN. Uso: npm run admin:promote -- email@dominio.com */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.argv[2]?.toLowerCase();

async function main() {
  if (!email) throw new Error("Informe o e-mail: npm run admin:promote -- email@dominio.com");
  const user = await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  await prisma.auditLog.create({ data: { action: "admin.promote_cli", entityType: "user", entityId: user.id, metadata: { email } } });
  console.log(`✔ ${email} agora é ADMIN`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
