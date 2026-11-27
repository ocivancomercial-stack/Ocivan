import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { getCurrentUser } from "@/lib/session";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeRedirectPath(sp.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Crie sua conta</h1>
        <p className="mt-1 text-muted">Leva menos de um minuto. É grátis para comprar e para anunciar.</p>
      </div>
      <SignUpForm next={next} />
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
