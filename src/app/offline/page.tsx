import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export const metadata = { title: "Sem conexão", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="size-14" />
      <WifiOff className="size-8 text-muted" />
      <h1 className="text-2xl font-extrabold">Você está sem conexão</h1>
      <p className="max-w-sm text-muted">Verifique sua internet e tente de novo. Por segurança, pedidos e pagamentos só funcionam on-line.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa ao voltar a conexão */}
      <a href="/" className="rounded-full bg-brand px-5 py-3 font-semibold text-white">Tentar novamente</a>
    </main>
  );
}
