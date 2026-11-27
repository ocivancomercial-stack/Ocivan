import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "@/features/auth/password-reset-forms";

export const metadata: Metadata = { title: "Redefinir senha", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token, error } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-900">Crie uma nova senha</h1>
      {!token || error ? (
        <Alert tone="error">
          Link inválido ou expirado.{" "}
          <Link href="/recuperar-senha" className="font-semibold underline">
            Pedir um novo link
          </Link>
        </Alert>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </div>
  );
}
