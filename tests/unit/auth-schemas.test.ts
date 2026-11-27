import { describe, expect, it } from "vitest";
import { passwordProblems, phoneSchema, signInSchema, signUpSchema } from "@/schemas/auth";

const valid = {
  name: "Maria Souza",
  email: "Maria@Exemplo.com ",
  phone: "(41) 99876-5432",
  password: "brechoCWB2026",
  confirmPassword: "brechoCWB2026",
  city: "Curitiba",
  termsAccepted: true,
};

describe("cadastro — validação", () => {
  it("aceita dados válidos e normaliza e-mail e telefone", () => {
    const r = signUpSchema.parse(valid);
    expect(r.email).toBe("maria@exemplo.com");
    expect(r.phone).toBe("41998765432");
  });

  it("exige aceite dos termos", () => {
    const r = signUpSchema.safeParse({ ...valid, termsAccepted: false });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "termsAccepted")).toBe(true);
  });

  it("exige confirmação de senha igual", () => {
    const r = signUpSchema.safeParse({ ...valid, confirmPassword: "outraSenha1" });
    expect(r.error?.issues.find((i) => i.path[0] === "confirmPassword")?.message).toMatch(/não conferem/);
  });

  it("aceita apenas cidades atendidas (Curitiba e RMC)", () => {
    expect(signUpSchema.safeParse({ ...valid, city: "São José dos Pinhais" }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, city: "São Paulo" }).success).toBe(false);
  });

  it("exige nome e sobrenome", () => {
    expect(signUpSchema.safeParse({ ...valid, name: "Maria" }).success).toBe(false);
  });
});

describe("política de senha", () => {
  it.each([
    ["curta1", /8 caracteres/],
    ["somenteletras", /número/],
    ["1234567890", /letra/],
    ["senha123", /comum/],
  ])("rejeita %s", (pwd, msg) => {
    expect(passwordProblems(pwd).join(" ")).toMatch(msg);
  });

  it("rejeita senha que contém o e-mail", () => {
    expect(passwordProblems("joaosilva99", "joaosilva@x.com")).toContain("A senha não pode conter seu e-mail");
  });

  it("aceita senha adequada", () => {
    expect(passwordProblems("Desapega!2026", "ana@x.com")).toEqual([]);
  });

  it("limita a 128 caracteres", () => {
    expect(passwordProblems("a1".repeat(65)).length).toBeGreaterThan(0);
  });
});

describe("telefone e login", () => {
  it("normaliza telefone com +55", () => {
    expect(phoneSchema.parse("+55 41 3333-4444")).toBe("4133334444");
  });
  it("rejeita telefone sem DDD", () => {
    expect(phoneSchema.safeParse("99999-9999").success).toBe(false);
  });
  it("login exige senha", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
