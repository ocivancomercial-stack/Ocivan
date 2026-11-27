import type { ProductCondition, ProductStatus } from "@prisma/client";

const CONDITION_SCHEMA: Record<ProductCondition, string> = {
  NEW_WITH_TAGS: "https://schema.org/NewCondition",
  NEW_WITHOUT_TAGS: "https://schema.org/NewCondition",
  EXCELLENT: "https://schema.org/UsedCondition",
  GOOD: "https://schema.org/UsedCondition",
  FAIR: "https://schema.org/UsedCondition",
};

const AVAILABILITY: Partial<Record<ProductStatus, string>> = {
  ACTIVE: "https://schema.org/InStock",
  RESERVED: "https://schema.org/LimitedAvailability",
  SOLD: "https://schema.org/SoldOut",
};

/** JSON-LD (schema.org/Product) do anúncio — sem dados pessoais do vendedor. */
export function productJsonLd(p: {
  id: string; title: string; description: string; priceCents: number; condition: ProductCondition; status: ProductStatus;
  brand?: { name: string } | null; color?: string | null; size?: string | null; city: string; images: { imageUrl: string }[];
  category: { name: string; parent?: { name: string } | null };
}, baseUrl: string) {
  const abs = (u: string) => (u.startsWith("http") ? u : `${baseUrl}${u}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description.slice(0, 500),
    image: p.images.map((i) => abs(i.imageUrl)),
    sku: p.id,
    category: [p.category.parent?.name, p.category.name].filter(Boolean).join(" > "),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand.name } } : {}),
    ...(p.color ? { color: p.color } : {}),
    ...(p.size ? { size: p.size } : {}),
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/produto/${p.id}`,
      priceCurrency: "BRL",
      price: (p.priceCents / 100).toFixed(2),
      itemCondition: CONDITION_SCHEMA[p.condition],
      availability: AVAILABILITY[p.status] ?? "https://schema.org/Discontinued",
      areaServed: { "@type": "City", name: `${p.city}, PR` },
    },
  };
}

/** Serializa para <script type="application/ld+json"> neutralizando "<" (evita fechar a tag / XSS). */
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
