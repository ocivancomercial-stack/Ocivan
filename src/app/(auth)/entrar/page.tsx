import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { SignInForm } from "@/features/auth/sign-in-form";
import { getCurrentUser } from "@/lib/session";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeRedirectPath(sp.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Que bom te ver!</h1>
        <p className="mt-1 text-muted">Entre para comprar, vender e acompanhar seus pedidos.</p>
      </div>
      {sp.senha === "redefinida" && <Alert tone="success">Senha redefinida. Entre com a nova senha.</Alert>}
      <SignInForm next={next} />
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">
          Cadastre-se grátis
        </Link>
      </p>
    </div>
  );
}
