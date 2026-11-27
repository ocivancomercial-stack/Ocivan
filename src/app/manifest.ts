import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Repassa Aí — moda de segunda mão em Curitiba",
    short_name: "Repassa Aí",
    description: "Compre perto. Venda fácil. Desapegue melhor.",
    id: "/",
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8F9F7",
    theme_color: "#174C3C",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Vender", url: "/vender", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Buscar", url: "/buscar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Meus pedidos", url: "/perfil/compras", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
