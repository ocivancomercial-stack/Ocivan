/**
 * Executado antes do `next build`.
 *  - MIGRATE_ON_BUILD=1 → aplica as migrations (prisma migrate deploy) — útil na Vercel sem terminal.
 *  - SEED_ON_BUILD=1    → roda o seed idempotente (catálogo; exemplos só fora de produção; admin se SEED_ADMIN_*).
 * Sem essas variáveis, não faz nada.
 */
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });

if (process.env.MIGRATE_ON_BUILD === "1") {
  console.log("▶ prisma migrate deploy");
  run("npx prisma migrate deploy");
}
if (process.env.SEED_ON_BUILD === "1") {
  console.log("▶ seed");
  run("npx prisma db seed");
}
