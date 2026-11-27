import { describe, expect, it } from "vitest";
import { productJsonLd, serializeJsonLd } from "@/features/seo/structured-data";
import { buildCsp } from "@/lib/csp";
import robots from "@/app/robots";
import manifest from "@/app/manifest";

const product = {
  id: "p1", title: "Jaqueta </script><script>alert(1)</script>", description: "desc", priceCents: 12990, condition: "GOOD" as const, status: "ACTIVE" as const,
  brand: { name: "Levi's" }, color: "Azul", size: "M", city: "Curitiba", images: [{ imageUrl: "/uploads/products/a.webp" }], category: { name: "Jaquetas", parent: { name: "Roupas" } },
};

describe("dados estruturados", () => {
  it("gera schema.org/Product com oferta em BRL, condição e disponibilidade", () => {
    const ld = productJsonLd(product, "https://repassaai.com.br");
    expect(ld.offers).toMatchObject({ price: "129.90", priceCurrency: "BRL", itemCondition: "https://schema.org/UsedCondition", availability: "https://schema.org/InStock" });
    expect(ld.image[0]).toBe("https://repassaai.com.br/uploads/products/a.webp");
  });
  it("serialização não permite fechar a tag script (XSS)", () => {
    const out = serializeJsonLd(productJsonLd(product, "https://x"));
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });
});

describe("CSP", () => {
  it("scripts só com nonce (sem unsafe-inline) e bloqueio de frames", () => {
    const csp = buildCsp("abc123", { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://repassaai.com.br" } as NodeJS.ProcessEnv);
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc123'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("robots e manifest", () => {
  it("fora de produção bloqueia indexação", () => {
    process.env.APP_ENV = "test";
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });
  it("em produção esconde áreas privadas", () => {
    process.env.APP_ENV = "production";
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toEqual(expect.arrayContaining(["/admin", "/pedidos", "/api/", "/checkout"]));
    process.env.APP_ENV = "test";
  });
  it("manifest instalável (nome, ícones 192/512 e maskable, standalone)", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.icons?.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(m.icons?.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
