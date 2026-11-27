import Image from "next/image";
import Link from "next/link";
import { Heart, PlusCircle, ShoppingBag, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { SearchBox } from "./search-box";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:h-18 md:gap-6">
        <Link href="/" aria-label="Repassa Aí — página inicial" className="shrink-0">
          <Logo />
        </Link>

        <SearchBox className="hidden max-w-xl md:block" />

        <nav aria-label="Menu" className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="/explorar" className="rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50">
            Explorar
          </Link>
          <Link href="/favoritos" className="rounded-full p-2.5 text-ink hover:bg-brand-50" aria-label="Favoritos">
            <Heart className="size-5" />
          </Link>
          <Link href="/carrinho" className="rounded-full p-2.5 text-ink hover:bg-brand-50" aria-label="Carrinho">
            <ShoppingBag className="size-5" />
          </Link>
          {user ? (
            <Link href="/perfil" className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold hover:bg-brand-50">
              <span className="relative grid size-8 place-items-center overflow-hidden rounded-full bg-brand-50 text-brand-900">
                {user.avatar ? <Image src={user.avatar} alt="" fill sizes="32px" className="object-cover" /> : user.name.charAt(0).toUpperCase()}
              </span>
              {user.name.split(" ")[0]}
            </Link>
          ) : (
            <Link href="/entrar" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold hover:bg-brand-50">
              <User className="size-5" /> Entrar
            </Link>
          )}
          <ButtonLink href="/vender" className="ml-2">
            <PlusCircle className="size-5" /> Vender
          </ButtonLink>
        </nav>

        {/* Celular: carrinho no topo; o resto fica na navegação inferior */}
        <Link href="/carrinho" className="ml-auto rounded-full p-2.5 text-ink md:hidden" aria-label="Carrinho">
          <ShoppingBag className="size-6" />
        </Link>
      </div>
    </header>
  );
}
