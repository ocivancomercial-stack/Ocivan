import { ImageResponse } from "next/og";

export const alt = "Repassa Aí — Compre perto. Venda fácil. Desapegue melhor.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#174C3C", color: "white" }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: "#E5F3EB" }}>Repassa Aí</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>Compre perto.</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>Venda fácil.</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, color: "#E7B75B" }}>Desapegue melhor.</div>
        <div style={{ fontSize: 30, marginTop: 32, color: "#CFE8DB" }}>Moda de segunda mão em Curitiba e Região Metropolitana</div>
      </div>
    ),
    size,
  );
}
