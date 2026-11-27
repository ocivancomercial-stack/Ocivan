import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/password-reset-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Esqueceu a senha?</h1>
        <p className="mt-1 text-muted">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm">
        <Link href="/entrar" className="font-semibold text-brand hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
