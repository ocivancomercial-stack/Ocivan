import type { ProductCondition, ProductStatus } from "@prisma/client";

export const CONDITION_OPTIONS: { value: ProductCondition; label: string; hint: string }[] = [
  { value: "NEW_WITH_TAGS", label: "Novo com etiqueta", hint: "Nunca usado, com etiqueta original" },
  { value: "NEW_WITHOUT_TAGS", label: "Novo sem etiqueta", hint: "Nunca usado, sem etiqueta" },
  { value: "EXCELLENT", label: "Seminovo", hint: "Usado poucas vezes, sem sinais de uso" },
  { value: "GOOD", label: "Bom estado", hint: "Sinais leves de uso" },
  { value: "FAIR", label: "Usado", hint: "Marcas de uso visíveis (descreva nos defeitos)" },
];
export const CONDITION_LABEL = Object.fromEntries(CONDITION_OPTIONS.map((c) => [c.value, c.label])) as Record<ProductCondition, string>;

export const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  ACTIVE: "Ativo",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  PAUSED: "Pausado",
  REMOVED: "Removido",
};

export const COLORS = [
  "Preto", "Branco", "Cinza", "Bege", "Marrom", "Azul", "Azul-marinho", "Verde", "Vermelho", "Rosa",
  "Roxo", "Amarelo", "Laranja", "Dourado", "Prateado", "Estampado", "Colorido",
];

/** Sugestões de tamanho por categoria raiz (o campo aceita outros valores curtos). */
export const SIZE_SUGGESTIONS: Record<string, string[]> = {
  roupas: ["PP", "P", "M", "G", "GG", "XG", "34", "36", "38", "40", "42", "44", "46", "48", "50", "Único"],
  tenis: ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  sapatos: ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  bolsas: ["Único", "Pequena", "Média", "Grande"],
};

export const DISTANCE_OPTIONS = [5, 10, 25, 50] as const;

export const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
] as const;

export const PRICE_LIMITS = { minCents: 500, maxCents: 5_000_000 }; // R$ 5 a R$ 50.000

export const REPORT_REASONS = [
  "Produto falsificado ou réplica",
  "Fora das categorias permitidas",
  "Fotos ou descrição enganosas",
  "Contato para negociar fora da plataforma",
  "Conteúdo ofensivo",
  "Outro",
] as const;
