import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicListingAssistant } from "@/services/ai/anthropic-assistant";
import { AssistantError } from "@/services/ai/listing-assistant";

const context = { categories: ["roupas-jaquetas-e-casacos", "tenis-corrida"], brands: ["Nike", "Adidas"], colors: ["Verde", "Preto"] };
const image = { data: Buffer.from("fake-webp"), contentType: "image/webp" as const };

function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn().mockResolvedValue({ model: "claude-opus-5-5", usage: { input_tokens: 1000, output_tokens: 200 }, stop_reason: "end_turn", ...response });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const good = {
  title: "Jaqueta corta-vento com capuz verde",
  description: "Jaqueta leve com capuz e zíper frontal.",
  categorySlug: "roupas-jaquetas-e-casacos",
  brandName: "adidas",
  color: "Verde",
  visibleFeatures: ["capuz", "zíper frontal"],
  keywords: ["corta-vento"],
  isFashionItem: true,
};

describe("assistente de anúncio (Claude)", () => {
  it("envia a foto, o catálogo e as opções corretas para a API", async () => {
    const { client, parse } = fakeClient({ parsed_output: good });
    await new AnthropicListingAssistant(client, "claude-opus-5-5").suggest(image, context);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/webp", data: image.data.toString("base64") } });
    expect(JSON.stringify(params.system)).toContain("tenis-corrida");
    expect(JSON.stringify(params.system)).toMatch(/Nunca afirme autenticidade/);
  });

  it("normaliza a marca e mantém só valores do catálogo", async () => {
    const { client } = fakeClient({ parsed_output: good });
    const s = await new AnthropicListingAssistant(client).suggest(image, context);
    expect(s.brandName).toBe("Adidas");
    expect(s.categorySlug).toBe("roupas-jaquetas-e-casacos");
    expect(s.disclaimers.length).toBeGreaterThan(0);
  });

  it("descarta marca, categoria e cor fora do catálogo", async () => {
    const { client } = fakeClient({ parsed_output: { ...good, brandName: "Gucci", categorySlug: "eletronicos", color: "Fúcsia neon" } });
    const s = await new AnthropicListingAssistant(client).suggest(image, context);
    expect(s).toMatchObject({ brandName: undefined, categorySlug: undefined, color: undefined });
  });

  it("trata recusa do modelo", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    await expect(new AnthropicListingAssistant(client).suggest(image, context)).rejects.toThrow(AssistantError);
  });

  it("recusa foto que não é de moda", async () => {
    const { client } = fakeClient({ parsed_output: { ...good, isFashionItem: false } });
    await expect(new AnthropicListingAssistant(client).suggest(image, context)).rejects.toThrow(/Não identificamos/);
  });
});
