import { execSync } from "node:child_process";

/** Aplica as migrations no banco de teste antes da suíte. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://repassa:repassa@localhost:5432/repassa_test?schema=public";
  if (!/test/.test(url)) throw new Error("TEST_DATABASE_URL precisa apontar para um banco de TESTE");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url }, stdio: "pipe" });
}
