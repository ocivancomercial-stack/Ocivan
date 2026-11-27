import { z } from "zod";
import { citySchema } from "@/schemas/auth";
import { parseBRLToCents } from "@/lib/utils";
import { COLORS, PRICE_LIMITS, REPORT_REASONS } from "@/features/products/constants";

// Impede negociação fora da plataforma: telefones, e-mails, WhatsApp, @perfis.
const CONTACT_PATTERNS = [
  /\b\d{2}\s?9?\d{4}[-\s.]?\d{4}\b/, // telefone
  /\(\d{2}\)\s?9?\d{4}/,
  /[\w.+-]+@[\w-]+\.[\w.]+/, // e-mail
  /\b(whats\s?app|wpp|zap|telegram|insta(gram)?|direct)\b/i,
  /(^|\s)@[a-z0-9_.]{3,}/i,
];
export function containsContactInfo(text: string) {
  return CONTACT_PATTERNS.some((re) => re.test(text));
}
const noContact = (field: string) => (v: string | undefined) => !v || !containsContactInfo(v) || `Não inclua telefone, e-mail ou redes sociais em ${field}`;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const productDetailsBase = z.object({
  title: z.string().trim().min(5, "Título muito curto (mínimo 5 caracteres)").max(80, "Máximo de 80 caracteres"),
  categoryId: z.string().min(1, "Escolha a categoria"),
  brandId: optionalText(40),
  size: z.string().trim().min(1, "Informe o tamanho").max(12, "Tamanho muito longo"),
  color: z.enum(COLORS as [string, ...string[]], { error: "Escolha a cor" }),
  condition: z.enum(["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "EXCELLENT", "GOOD", "FAIR"], { error: "Escolha o estado de conservação" }),
  description: z.string().trim().min(20, "Descreva com pelo menos 20 caracteres").max(2000, "Máximo de 2.000 caracteres"),
  defects: optionalText(500),
});

function refineContact(d: { title: string; description: string; defects?: string }, ctx: z.RefinementCtx) {
  for (const [field, label] of [["title", "o título"], ["description", "a descrição"], ["defects", "os defeitos"]] as const) {
    const r = noContact(label)(d[field]);
    if (r !== true) ctx.addIssue({ code: "custom", path: [field], message: r });
  }
}

/** Etapa "Detalhes" do formulário (também valida contato fora da plataforma). */
export const productDetailsSchema = productDetailsBase.superRefine(refineContact);

export const productPriceSchema = z.object({
  price: z
    .string()
    .transform((v, ctx) => {
      const cents = parseBRLToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Informe um preço válido" });
        return z.NEVER;
      }
      return cents;
    })
    .refine((c) => c >= PRICE_LIMITS.minCents, "O preço mínimo é R$ 5,00")
    .refine((c) => c <= PRICE_LIMITS.maxCents, "O preço máximo é R$ 50.000,00"),
  city: citySchema,
  shippingAvailable: z.boolean(),
  localPickup: z.boolean(),
});

export const productInputSchema = productDetailsBase
  .extend(productPriceSchema.shape)
  .superRefine((d, ctx) => {
    refineContact(d, ctx);
    if (!d.shippingAvailable && !d.localPickup)
      ctx.addIssue({ code: "custom", path: ["shippingAvailable"], message: "Escolha ao menos uma forma de entrega" });
  });

export type ProductInput = z.output<typeof productInputSchema>;

export const searchParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  categoria: z.string().max(60).optional().catch(undefined),
  subcategoria: z.string().max(80).optional().catch(undefined),
  marca: z.string().max(60).optional().catch(undefined),
  tamanho: z.string().max(12).optional().catch(undefined),
  estado: z.enum(["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "EXCELLENT", "GOOD", "FAIR"]).optional().catch(undefined),
  precoMin: z.coerce.number().min(0).max(50000).optional().catch(undefined),
  precoMax: z.coerce.number().min(0).max(50000).optional().catch(undefined),
  cidade: z.string().max(60).optional().catch(undefined),
  perto: z.string().max(60).optional().catch(undefined),
  distancia: z.coerce.number().int().refine((n) => [5, 10, 25, 50].includes(n)).optional().catch(undefined),
  ordem: z.enum(["recentes", "menor-preco", "maior-preco"]).catch("recentes").default("recentes"),
  pagina: z.coerce.number().int().min(1).max(100).catch(1).default(1),
});
export type SearchFilters = z.output<typeof searchParamsSchema>;

export const reportSchema = z.object({
  productId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  description: optionalText(500),
});
