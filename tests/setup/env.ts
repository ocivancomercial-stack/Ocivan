import { vi } from "vitest";

// Banco ISOLADO para testes — nunca aponte para o banco de desenvolvimento ou produção.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://repassa:repassa@localhost:5432/repassa_test?schema=public";
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.APP_ENV = "test";
process.env.EMAIL_PROVIDER = "console";

// "server-only" lança fora do bundler do Next; nos testes é um no-op.
vi.mock("server-only", () => ({}));
