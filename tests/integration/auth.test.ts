import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConsoleEmailProvider, setEmailProvider } from "@/services/email";
import { resetDatabase } from "../setup/db";

const ORIGIN = "http://localhost:3000";
const mailbox = new ConsoleEmailProvider();
setEmailProvider(mailbox);

/** Chama a API HTTP real do Better Auth (mesmo caminho de /api/auth/*). */
async function call(path: string, body?: unknown, cookie?: string, method = "POST") {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method,
      headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  const setCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const json = await res.json().catch(() => null);
  return { status: res.status, json, cookie: setCookie };
}

const newUser = {
  name: "Joana Teste",
  email: "joana@teste.dev",
  password: "Desapega2026",
  phone: "41999990000",
  city: "Curitiba",
  termsAccepted: true,
};

beforeEach(async () => {
  await resetDatabase();
  mailbox.sent.length = 0;
});
afterAll(() => prisma.$disconnect());

describe("cadastro", () => {
  it("cria usuário com papel USER, aceite de termos registrado e senha com hash", async () => {
    const r = await call("/sign-up/email", newUser);
    expect(r.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: newUser.email }, include: { accounts: true } });
    expect(user.role).toBe("USER");
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user.phone).toBe("41999990000");
    expect(user.accounts[0].password).toBeTruthy();
    expect(user.accounts[0].password).not.toContain(newUser.password);
  });

  it("recusa cadastro sem aceite dos termos mesmo chamando a API diretamente", async () => {
    const r = await call("/sign-up/email", { ...newUser, termsAccepted: false });
    expect(r.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("recusa senha fraca na API", async () => {
    const r = await call("/sign-up/email", { ...newUser, password: "senhasemnumero" });
    expect(r.status).toBe(400);
  });

  it("impede que o cliente se torne ADMIN no cadastro", async () => {
    const r = await call("/sign-up/email", { ...newUser, role: "ADMIN" });
    // Better Auth rejeita campos com input:false; em qualquer caso, nunca cria ADMIN.
    const user = await prisma.user.findUnique({ where: { email: newUser.email } });
    expect(r.status === 400 || user?.role === "USER").toBe(true);
    expect(user?.role ?? "USER").toBe("USER");
  });

  it("não permite e-mail duplicado", async () => {
    await call("/sign-up/email", newUser);
    const r = await call("/sign-up/email", { ...newUser, name: "Outra Pessoa" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("login e sessão", () => {
  it("entra com credenciais corretas e obtém sessão", async () => {
    await call("/sign-up/email", newUser);
    const login = await call("/sign-in/email", { email: newUser.email, password: newUser.password });
    expect(login.status).toBe(200);
    expect(login.cookie).toMatch(/session_token=/);
    const session = await call("/get-session", undefined, login.cookie, "GET");
    expect(session.json?.user?.email).toBe(newUser.email);
  });

  it("recusa senha incorreta", async () => {
    await call("/sign-up/email", newUser);
    const r = await call("/sign-in/email", { email: newUser.email, password: "Errada12345" });
    expect(r.status).toBe(401);
  });

  it("bloqueia login de conta suspensa", async () => {
    await call("/sign-up/email", newUser);
    await prisma.user.update({ where: { email: newUser.email }, data: { status: "SUSPENDED" } });
    const r = await call("/sign-in/email", { email: newUser.email, password: newUser.password });
    expect(r.status).toBe(403);
  });

  it("logout invalida a sessão no servidor", async () => {
    await call("/sign-up/email", newUser);
    const login = await call("/sign-in/email", { email: newUser.email, password: newUser.password });
    await call("/sign-out", {}, login.cookie);
    const session = await call("/get-session", undefined, login.cookie, "GET");
    expect(session.json).toBeNull();
  });

  it("recusa requisição de outra origem (CSRF)", async () => {
    await call("/sign-up/email", newUser);
    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://site-malicioso.com", cookie: "x=1" },
        body: JSON.stringify({ email: newUser.email, password: newUser.password, callbackURL: "https://site-malicioso.com" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("recuperação de senha", () => {
  it("envia link, redefine a senha e revoga sessões antigas", async () => {
    await call("/sign-up/email", newUser);
    const oldLogin = await call("/sign-in/email", { email: newUser.email, password: newUser.password });

    const req = await call("/request-password-reset", { email: newUser.email, redirectTo: "/redefinir-senha" });
    expect(req.status).toBe(200);
    const resetMail = mailbox.sent.filter((m) => m.subject.includes("Redefinição"));
    expect(resetMail).toHaveLength(1);
    const token = resetMail[0].text.match(/reset-password\/([^?\s]+)/)?.[1];
    expect(token).toBeTruthy();

    const reset = await call("/reset-password", { token, newPassword: "NovaSenha2027" });
    expect(reset.status).toBe(200);

    expect((await call("/sign-in/email", { email: newUser.email, password: newUser.password })).status).toBe(401);
    expect((await call("/sign-in/email", { email: newUser.email, password: "NovaSenha2027" })).status).toBe(200);
    expect((await call("/get-session", undefined, oldLogin.cookie, "GET")).json).toBeNull();
  });

  it("não revela se o e-mail existe", async () => {
    const r = await call("/request-password-reset", { email: "ninguem@teste.dev", redirectTo: "/redefinir-senha" });
    expect(r.status).toBe(200);
    expect(mailbox.sent).toHaveLength(0);
  });

  it("recusa token inválido", async () => {
    const r = await call("/reset-password", { token: "token-falso", newPassword: "NovaSenha2027" });
    expect(r.status).toBe(400);
  });
});
