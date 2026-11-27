import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const production = process.env.APP_ENV === "production";
  return {
    // Fora de produção (previews/homologação) nada é indexado.
    rules: production
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/api/", "/admin", "/perfil", "/vender", "/favoritos", "/carrinho", "/checkout", "/pedidos", "/privacidade/meus-dados", "/simulador", "/entrar", "/cadastro", "/recuperar-senha", "/redefinir-senha", "/offline"],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: production ? `${base}/sitemap.xml` : undefined,
  };
}
