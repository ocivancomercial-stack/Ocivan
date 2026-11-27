import { Heart, Home, PlusCircle, Search, User } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/vender", label: "Vender", icon: PlusCircle, highlight: true },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: User },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname === "/explorar" : pathname.startsWith(href);
}
