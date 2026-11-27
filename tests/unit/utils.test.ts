import { describe, expect, it } from "vitest";
import { formatBRL, parseBRLToCents, slugify } from "@/lib/utils";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { distanceKm, findCity } from "@/lib/regions";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("dinheiro", () => {
  it("formata centavos em BRL", () => {
    expect(formatBRL(12990).replace(/\s/g, " ")).toBe("R$ 129,90");
  });
  it.each([
    ["129,90", 12990],
    ["1.234,56", 123456],
    ["129.9", 12990],
    ["R$ 50", 5000],
    ["abc", null],
    ["-10", null],
  ])("converte %s", (input, cents) => expect(parseBRLToCents(input)).toBe(cents));
});

describe("redirecionamento seguro", () => {
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/ok\r\nSet-Cookie: x"])("bloqueia %s", (u) =>
    expect(safeRedirectPath(u)).toBe("/"),
  );
  it("aceita caminho interno", () => expect(safeRedirectPath("/perfil?x=1")).toBe("/perfil?x=1"));
});

describe("regiões", () => {
  it("calcula distância aproximada Curitiba → São José dos Pinhais (~13 km)", () => {
    const d = distanceKm(findCity("Curitiba")!, findCity("São José dos Pinhais")!);
    expect(d).toBeGreaterThan(8);
    expect(d).toBeLessThan(18);
  });
  it("slugify remove acentos", () => expect(slugify("Tênis & Sapatos")).toBe("tenis-sapatos"));
});

describe("cifragem de segredos (AES-256-GCM)", () => {
  const key = Buffer.alloc(32, 1).toString("base64");
  it("cifra e decifra", () => {
    const enc = encryptSecret("APP_USR-token", key);
    expect(enc).not.toContain("APP_USR");
    expect(decryptSecret(enc, key)).toBe("APP_USR-token");
  });
  it("detecta adulteração", () => {
    const enc = encryptSecret("segredo", key).split(".");
    enc[3] = Buffer.from("xxxxxxx").toString("base64");
    expect(() => decryptSecret(enc.join("."), key)).toThrow();
  });
  it("rejeita chave de tamanho errado", () => {
    expect(() => encryptSecret("x", Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
