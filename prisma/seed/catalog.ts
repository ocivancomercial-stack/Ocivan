/** Catálogo inicial: categorias permitidas na v1, subcategorias e marcas populares (editáveis no admin). */
export const CATEGORY_TREE = [
  {
    name: "Roupas",
    slug: "roupas",
    children: [
      "Camisetas", "Camisas", "Blusas", "Vestidos", "Saias", "Calças", "Jeans", "Shorts e bermudas",
      "Jaquetas e casacos", "Moletons", "Malhas e tricôs", "Roupas esportivas", "Macacões",
    ],
  },
  { name: "Tênis", slug: "tenis", children: ["Casual", "Corrida", "Basquete", "Skate", "Cano alto", "Treino e academia"] },
  { name: "Sapatos", slug: "sapatos", children: ["Sociais", "Mocassins e loafers", "Sandálias", "Salto alto", "Botas", "Rasteiras", "Sapatilhas"] },
  { name: "Bolsas", slug: "bolsas", children: ["Bolsas de ombro", "Transversais", "Tote e shopper", "Mochilas", "Clutches", "Carteiras", "Pochetes"] },
] as const;

export const BRANDS = [
  "Nike", "Adidas", "Puma", "New Balance", "Vans", "Converse", "Mizuno", "Asics", "Olympikus", "Fila", "Reebok",
  "Zara", "Renner", "C&A", "Riachuelo", "Hering", "Farm", "Animale", "Osklen", "Reserva", "Levi's", "Arezzo",
  "Schutz", "Melissa", "Vizzano", "Santa Lolla", "Dakota", "Anacapri", "Shein", "Calvin Klein", "Tommy Hilfiger",
  "Lacoste", "Colcci", "Forum", "Youcom",
];

export const DEFAULT_SETTINGS = {
  platform_fee_bps: 1200, // 12% sobre o valor dos produtos
  reservation_minutes: 15, // reserva temporária no checkout
  listing_moderation: "auto", // "auto" publica direto | "manual" envia para revisão
  max_images_per_product: 8,
} as const;
