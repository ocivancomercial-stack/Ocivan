"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/anuncios", label: "Anúncios" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/denuncias", label: "Denúncias" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/marcas", label: "Marcas" },
  { href: "/admin/cupons", label: "Cupons" },
  { href: "/admin/configuracoes", label: "Configurações" },
  { href: "/admin/integracoes", label: "Integrações" },
  { href: "/admin/relatorios", label: "Relatórios" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="flex gap-1 overflow-x-auto md:flex-col">
      {ADMIN_LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap rounded-field px-3 py-2 text-sm font-semibold",
              active ? "bg-brand text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
