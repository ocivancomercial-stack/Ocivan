import { ButtonLink } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="size-14" />
      <h1 className="text-2xl font-extrabold">Página não encontrada</h1>
      <p className="text-muted">Essa peça já foi repassada… ou o endereço está errado.</p>
      <ButtonLink href="/">Voltar ao início</ButtonLink>
    </main>
  );
}
