import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SUPPORT_EMAIL } from "@/features/legal/content";

export const metadata: Metadata = { title: "Contato e suporte" };

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-extrabold text-brand-900">Contato e suporte</h1>
      <Card className="flex items-start gap-4 p-6">
        <Mail className="mt-1 size-6 text-brand" />
        <div>
          <p className="font-semibold">E-mail</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand underline">
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-2 text-sm text-muted">Canal provisório. Para pedidos, informe o código do pedido (ex.: RA-XXXXXX).</p>
        </div>
      </Card>
    </div>
  );
}
