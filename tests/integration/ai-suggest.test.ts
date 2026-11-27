import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setListingAssistant, sanitizeSuggestion, type ListingAssistant } from "@/services/ai/listing-assistant";
import { AI_LIMITS, suggestListingFromPhoto } from "@/features/products/ai-suggest";
import { resetDatabase } from "../setup/db";
import { makeCatalog, makeUser, photo } from "../setup/fixtures";

const fake: ListingAssistant = {
  name: "fake",
  async suggest(_img, ctx) {
    return sanitizeSuggestion({ title: "Tênis de corrida preto", categorySlug: "tenis-corrida", brandName: "nike", color: "Preto", visibleFeatures: [], keywords: [] }, ctx);
  },
};

beforeEach(resetDatabase);
afterEach(() => setListingAssistant(null));
afterAll(() => prisma.$disconnect());

describe("sugestões por IA", () => {
  it("converte a sugestão em IDs do catálogo", async () => {
    const cat = await makeCatalog();
    const u = await makeUser("a@t.dev");
    setListingAssistant(fake);
    const r = await suggestListingFromPhoto(u.id, await photo());
    expect(r).toMatchObject({ categoryId: cat.corrida.id, rootCategoryId: cat.tenis.id, brandId: cat.nike.id, color: "Preto" });
  });

  it("recusa quando a IA está desligada", async () => {
    const u = await makeUser("a@t.dev");
    setListingAssistant(null);
    await expect(suggestListingFromPhoto(u.id, await photo())).rejects.toThrow(/desativado/);
  });

  it("valida a foto antes de chamar a IA", async () => {
    const u = await makeUser("a@t.dev");
    let called = false;
    setListingAssistant({ ...fake, suggest: async (...a) => ((called = true), fake.suggest(...a)) });
    await expect(suggestListingFromPhoto(u.id, Buffer.from("não é imagem"))).rejects.toThrow();
    expect(called).toBe(false);
  });

  it(`limita a ${AI_LIMITS.perHour} sugestões por hora por vendedor`, async () => {
    await makeCatalog();
    const u = await makeUser("a@t.dev");
    setListingAssistant(fake);
    const img = await photo();
    for (let i = 0; i < AI_LIMITS.perHour; i++) await suggestListingFromPhoto(u.id, img);
    await expect(suggestListingFromPhoto(u.id, img)).rejects.toThrow(/limite/);
  });
});
