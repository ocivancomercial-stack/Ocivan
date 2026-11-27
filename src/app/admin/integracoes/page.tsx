import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { mocksEnabled } from "@/mocks/common";
import { getPaymentProvider } from "@/services/payments";
import { getShippingProvider } from "@/services/shipping";

export const metadata = { title: "Integrações" };

function modeLabel(name: string, isSimulated: boolean) {
  if (name === "simulated") return "Simulado interno (desenvolvimento)";
  return isSimulated ? "Integração real apontando para o SIMULADOR (modelo de teste)" : "Integração real (provedor oficial)";
}

export default async function AdminIntegrations({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const payments = getPaymentProvider();
  const shipping = getShippingProvider();
  const [meCred, sellers] = await Promise.all([
    prisma.integrationCredential.findUnique({ where: { provider: "melhorenvio" } }),
    prisma.sellerPaymentAccount.count(),
  ]);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold">Integrações</h1>
      {status === "conectado" && <Alert tone="success">Melhor Envio conectado.</Alert>}
      {status === "erro" && <Alert tone="error">Falha ao conectar. Confira client id, secret e URL de callback.</Alert>}
      {mocksEnabled() && <Alert tone="warning">Simuladores ativos (MOCK_PROVIDERS=1): nenhum pagamento ou etiqueta é real.</Alert>}
      <Card className="space-y-2 p-5">
        <h2 className="font-bold">Pagamentos — {payments.name}</h2>
        <p className="text-sm">{modeLabel(payments.name, payments.isSimulated)}</p>
        {payments.requiresSellerAccount && <p className="text-sm text-muted">{sellers} vendedor(es) com conta conectada.</p>}
        <p className="text-xs text-muted">Webhook: {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments/{payments.name}</p>
      </Card>
      <Card className="space-y-2 p-5">
        <h2 className="font-bold">Frete — {shipping.name}</h2>
        <p className="text-sm">{modeLabel(shipping.name, shipping.isSimulated)}</p>
        {shipping.supportsLabels && (
          <>
            <p className="text-sm">{meCred || process.env.MELHORENVIO_TOKEN ? `Conta da plataforma conectada${meCred?.expiresAt ? ` (token até ${meCred.expiresAt.toLocaleDateString("pt-BR")})` : ""}.` : "Conta da plataforma NÃO conectada — cotação e etiquetas indisponíveis."}</p>
            <ButtonLink href="/api/integrations/melhorenvio/connect" size="sm" variant={meCred ? "outline" : "primary"} prefetch={false}>{meCred ? "Reconectar" : "Conectar Melhor Envio"}</ButtonLink>
            <p className="text-xs text-muted">Webhook: {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shipping/melhorenvio · Callback OAuth: {process.env.NEXT_PUBLIC_APP_URL}/api/integrations/melhorenvio/callback</p>
          </>
        )}
      </Card>
    </div>
  );
}
