import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;

// Content-Security-Policy: restringe origens de scripts, imagens e conexões (mitigação de XSS).
// 'unsafe-inline' em script-src é necessário para os scripts de hidratação do Next sem nonce;
// ver docs/SEGURANCA.md para o plano de migração para CSP com nonce.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://sdk.mercadopago.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""} https://*.mercadopago.com https://*.mlstatic.com`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}${supabaseHost ? ` https://${supabaseHost}` : ""} https://api.mercadopago.com https://*.mercadopago.com`,
  "frame-src 'self' https://*.mercadopago.com https://*.mercadopago.com.br",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.mercadopago.com https://*.mercadopago.com.br",
  "object-src 'none'",
  ...(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// HSTS apenas quando servido via HTTPS (evita "travar" localhost em HTTPS durante o desenvolvimento).
if (process.env.NEXT_PUBLIC_APP_URL?.startsWith("https:")) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    localPatterns: [{ pathname: "/uploads/**", search: "" }, { pathname: "/icons/**", search: "" }],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // upload de até 8 fotos comprimidas
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
