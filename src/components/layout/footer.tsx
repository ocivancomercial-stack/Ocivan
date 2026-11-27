import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Repassa Aí",
    links: [
      { href: "/como-funciona", label: "Como funciona" },
      { href: "/explorar", label: "Explorar produtos" },
      { href: "/vender", label: "Começar a vender" },
      { href: "/suporte", label: "Contato e suporte" },
    ],
  },
  {
    title: "Políticas",
    links: [
      { href: "/termos", label: "Termos de uso" },
      { href: "/privacidade", label: "Política de privacidade" },
      { href: "/cookies", label: "Política de cookies" },
      { href: "/reembolso", label: "Reembolso e cancelamento" },
      { href: "/anuncios-proibidos", label: "Anúncios proibidos" },
    ],
  },
  {
    title: "Sua conta",
    links: [
      { href: "/perfil", label: "Meu perfil" },
      { href: "/privacidade/meus-dados", label: "Meus dados (LGPD)" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-brand-900 text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Logo inverted />
          <p className="text-sm">Compre perto. Venda fácil. Desapegue melhor.</p>
          <p className="text-xs text-white/60">Marketplace de moda de segunda mão em Curitiba e Região Metropolitana — PR.</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="mb-3 text-sm font-bold text-white">{col.title}</h2>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Repassa Aí. Versão em desenvolvimento (MVP).
      </div>
    </footer>
  );
}
