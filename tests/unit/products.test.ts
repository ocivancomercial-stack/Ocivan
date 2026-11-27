import { describe, expect, it } from "vitest";
import { canOwner, nextStatus } from "@/features/products/status";
import { buildTsQuery, citiesWithin } from "@/features/products/search";
import { containsContactInfo, productInputSchema, searchParamsSchema } from "@/schemas/product";
import { parseImageOrder, ProductError } from "@/features/products/service";
import { publicName } from "@/features/products/queries";
import { sanitizeSuggestion } from "@/services/ai/listing-assistant";

const base = {
  title: "Tênis de corrida", categoryId: "c1", size: "40", color: "Preto", condition: "GOOD",
  description: "Tênis confortável, usado poucas vezes em corridas leves.", price: "199,90", city: "Curitiba",
  shippingAvailable: true, localPickup: false,
};

describe("estados do anúncio", () => {
  it("publicação respeita a moderação", () => {
    expect(nextStatus("publish", "DRAFT", "auto")).toBe("ACTIVE");
    expect(nextStatus("publish", "DRAFT", "manual")).toBe("IN_REVIEW");
  });
  it("pausar e reativar", () => {
    expect(nextStatus("pause", "ACTIVE", "auto")).toBe("PAUSED");
    expect(nextStatus("reactivate", "PAUSED", "auto")).toBe("ACTIVE");
  });
  it("edição de anúncio ativo com moderação manual volta para revisão", () => {
    expect(nextStatus("edit", "ACTIVE", "manual")).toBe("IN_REVIEW");
    expect(nextStatus("edit", "ACTIVE", "auto")).toBe("ACTIVE");
  });
  it.each(["SOLD", "RESERVED", "REMOVED"] as const)("anúncio %s não pode ser editado nem excluído pelo dono", (s) => {
    expect(canOwner("edit", s)).toBe(false);
    expect(canOwner("remove", s)).toBe(false);
  });
  it("transição inválida lança erro", () => {
    expect(() => nextStatus("pause", "SOLD", "auto")).toThrow();
  });
});

describe("validação do anúncio", () => {
  it("converte preço em centavos", () => {
    expect(productInputSchema.parse(base).price).toBe(19990);
  });
  it.each(["4,99", "50000,01", "abc"])("rejeita preço %s", (price) => {
    expect(productInputSchema.safeParse({ ...base, price }).success).toBe(false);
  });
  it.each([
    "Chama no whatsapp",
    "ligue 41 99999-8888",
    "meu email joao@gmail.com",
    "segue @brecho.cwb",
  ])("bloqueia contato fora da plataforma: %s", (text) => {
    expect(containsContactInfo(text)).toBe(true);
    const r = productInputSchema.safeParse({ ...base, description: `Produto muito bom e conservado. ${text}` });
    expect(r.success).toBe(false);
  });
  it("não confunde tamanho/medidas com telefone", () => {
    expect(containsContactInfo("Tamanho 40, cintura 78 cm, comprimento 102 cm")).toBe(false);
  });
  it("exige ao menos uma forma de entrega", () => {
    expect(productInputSchema.safeParse({ ...base, shippingAvailable: false }).success).toBe(false);
  });
  it("aceita só cidades atendidas", () => {
    expect(productInputSchema.safeParse({ ...base, city: "Londrina" }).success).toBe(false);
  });
});

describe("busca", () => {
  it("monta tsquery segura com prefixo", () => {
    expect(buildTsQuery("Jaqueta  jeans!")).toBe("jaqueta:* & jeans:*");
    expect(buildTsQuery("'); DROP TABLE products; --")).toBe("drop:* & table:* & products:*");
    expect(buildTsQuery("a")).toBeNull();
  });
  it("raio de distância a partir de Curitiba", () => {
    const near = citiesWithin("Curitiba", 10);
    expect(near).toContain("Curitiba");
    expect(near).not.toContain("Mandirituba");
    expect(citiesWithin("Curitiba", 50)).toContain("Mandirituba");
    expect(citiesWithin("Curitiba", 50)).not.toContain("Lapa"); // ~58 km
  });
  it("parâmetros inválidos da URL são ignorados com segurança", () => {
    const f = searchParamsSchema.parse({ precoMin: "abc", ordem: "hack", pagina: "-3", distancia: "7", estado: "X" });
    expect(f).toMatchObject({ precoMin: undefined, ordem: "recentes", pagina: 1, distancia: undefined, estado: undefined });
  });
});

describe("ordem das fotos", () => {
  it("interpreta existentes e novas", () => {
    expect(parseImageOrder('["existing:abc","new:0"]', 1)).toEqual([{ kind: "existing", id: "abc" }, { kind: "new", index: 0 }]);
  });
  it("recusa índice inexistente ou mais de 8 fotos", () => {
    expect(() => parseImageOrder('["new:3"]', 1)).toThrow(ProductError);
    expect(() => parseImageOrder(JSON.stringify(Array(9).fill("new:0")), 1)).toThrow(ProductError);
  });
});

describe("privacidade e IA", () => {
  it("nome público abreviado", () => {
    expect(publicName("Maria Souza Lima")).toBe("Maria L.");
    expect(publicName("Joana")).toBe("Joana");
  });
  it("sugestões da IA são filtradas contra listas permitidas", () => {
    const s = sanitizeSuggestion(
      { title: "x".repeat(200), brandName: "gucci", categorySlug: "inventada", color: "Preto", keywords: ["a"] },
      { categories: ["tenis-corrida"], brands: ["Nike"], colors: ["Preto"] },
    );
    expect(s.title).toHaveLength(80);
    expect(s.brandName).toBeUndefined();
    expect(s.categorySlug).toBeUndefined();
    expect(s.color).toBe("Preto");
    expect(s.disclaimers.join(" ")).toMatch(/autenticidade/);
  });
});
