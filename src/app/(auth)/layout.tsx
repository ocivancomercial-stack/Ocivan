import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-900 p-12 text-white md:flex md:flex-col md:justify-between">
        <Link href="/" aria-label="Página inicial">
          <Logo inverted />
        </Link>
        <div className="space-y-4">
          <p className="text-4xl font-extrabold leading-tight">
            Compre perto.
            <br />
            Venda fácil.
            <br />
            <span className="text-accent">Desapegue melhor.</span>
          </p>
          <p className="max-w-sm text-white/70">Moda de segunda mão em Curitiba e Região — com pagamento protegido e envio rastreado.</p>
        </div>
        <div aria-hidden className="absolute -bottom-24 -right-24 size-96 rounded-full border-[48px] border-brand/40" />
      </aside>
      <main className="flex flex-col px-4 py-8 pb-safe-nav md:justify-center md:px-12">
        <Link href="/" className="mb-8 md:hidden" aria-label="Página inicial">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
