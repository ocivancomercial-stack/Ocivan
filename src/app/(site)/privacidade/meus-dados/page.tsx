import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeleteAccountForm } from "@/features/privacy/delete-account-form";
import { SUPPORT_EMAIL } from "@/features/legal/content";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Meus dados (LGPD)", robots: { index: false } };

export default async function MyDataPage() {
  const user = await requireUser("/privacidade/meus-dados");
  const requests = await prisma.dataRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="size-6 text-brand" /> Meus dados</h1>
      <p className="text-sm text-muted">Seus direitos como titular de dados (LGPD, art. 18). Veja também a <Link href="/privacidade" className="text-brand underline">Política de privacidade</Link>.</p>

      <Card className="space-y-2 p-5">
        <h2 className="font-bold">Acessar e levar seus dados</h2>
        <p className="text-sm text-muted">Baixe uma cópia (JSON) com perfil, endereços, anúncios, compras, vendas, avaliações e acessos. Senhas e tokens não são incluídos.</p>
        <a href="/api/me/export" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"><Download className="size-4" /> Baixar meus dados</a>
      </Card>

      <Card className="space-y-2 p-5">
        <h2 className="font-bold">Corrigir dados</h2>
        <p className="text-sm text-muted">Nome, telefone, cidade, CPF e endereços podem ser alterados no <Link href="/perfil" className="text-brand underline">seu perfil</Link>. Para outras correções: {SUPPORT_EMAIL}.</p>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-bold text-danger">Excluir conta</h2>
        <p className="text-sm text-muted">
          Removemos seus dados de contato, CPF, endereços, foto, favoritos e anúncios não vendidos. Pedidos já concluídos são mantidos sem
          identificação direta pelo prazo exigido por lei (obrigações fiscais e de defesa do consumidor). Não é possível excluir com pedidos em andamento.
        </p>
        <DeleteAccountForm />
      </Card>

      {requests.length > 0 && (
        <section className="space-y-1 text-xs text-muted">
          <h2 className="font-semibold">Histórico de solicitações</h2>
          {requests.map((r) => <p key={r.id}>{r.createdAt.toLocaleString("pt-BR")} — {r.type === "ACCESS" ? "Exportação de dados" : r.type} ({r.status})</p>)}
        </section>
      )}
    </div>
  );
}
