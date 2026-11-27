import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getPaymentProvider } from "@/services/payments";
import { getShippingProvider } from "@/services/shipping";

export const metadata: Metadata = { title: "Recebimentos", robots: { index: false } };

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser("/perfil/recebimentos");
  const { status } = await searchParams;
  const payments = getPaymentProvider();
  const shipping = getShippingProvider();
  const [account, me, address] = await Promise.all([
    prisma.sellerPaymentAccount.findUnique({ where: { userId: user.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { cpf: true } }),
    prisma.address.findFirst({ where: { userId: user.id } }),
  ]);
  const steps = [
    { done: !payments.requiresSellerAccount || !!account, label: payments.requiresSellerAccount ? "Conectar sua conta Mercado Pago (para receber as vendas)" : "Recebimento de pagamentos (modo simulado — nada a conectar)" },
    { done: !!address, label: "Cadastrar endereço de envio (origem do frete)", href: "/perfil#enderecos" },
    { done: !shipping.supportsLabels || !!me.cpf, label: "Informar CPF (exigido para emitir etiquetas)", href: "/perfil" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-extrabold">Recebimentos</h1>
      {status === "conectado" && <Alert tone="success">Conta Mercado Pago conectada!</Alert>}
      {status === "erro" && <Alert tone="error">Não foi possível conectar a conta. Tente novamente.</Alert>}
      <Card className="space-y-3 p-5">
        <h2 className="font-bold">Para vender</h2>
        <ul className="space-y-2 text-sm">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              {s.done ? <CheckCircle2 className="size-5 text-brand" /> : <Circle className="size-5 text-muted" />}
              {s.href && !s.done ? <Link href={s.href} className="text-brand underline">{s.label}</Link> : s.label}
            </li>
          ))}
        </ul>
      </Card>
      {payments.requiresSellerAccount && (
        <Card className="space-y-3 p-5">
          <h2 className="font-bold">Mercado Pago</h2>
          {account ? (
            <p className="text-sm">Conectado (conta #{account.providerUserId}){account.isSimulated && <strong className="text-[#7a5410]"> — SIMULADOR</strong>}. Os pagamentos das suas vendas caem na sua conta Mercado Pago; a comissão da plataforma é descontada automaticamente.</p>
          ) : (
            <p className="text-sm text-muted">Você será levado ao Mercado Pago para autorizar o Repassa Aí a criar cobranças em seu nome. Não temos acesso à sua senha.</p>
          )}
          <ButtonLink href="/api/integrations/mercadopago/connect" variant={account ? "outline" : "primary"} prefetch={false}>
            {account ? "Reconectar conta" : "Conectar Mercado Pago"}
          </ButtonLink>
          <p className="text-xs text-muted">Saldo, taxas do provedor e datas de liberação aparecem na sua conta Mercado Pago.</p>
        </Card>
      )}
    </div>
  );
}
