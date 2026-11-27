import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BottomNav } from "@/components/layout/bottom-nav";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Repassa Aí — Compre perto. Venda fácil.", template: "%s · Repassa Aí" },
  description:
    "Marketplace de moda de segunda mão em Curitiba e Região Metropolitana. Compre e venda roupas, tênis, sapatos e bolsas com segurança.",
  applicationName: "Repassa Aí",
  appleWebApp: { capable: true, title: "Repassa Aí", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Repassa Aí" },
};

export const viewport: Viewport = {
  themeColor: "#174C3C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="min-h-dvh">
        <EnvironmentBanner />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
