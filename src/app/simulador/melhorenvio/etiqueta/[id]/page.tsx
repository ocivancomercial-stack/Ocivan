import { notFound } from "next/navigation";
import { mocksEnabled } from "@/mocks/common";
import { meGetOrder } from "@/mocks/melhorenvio";

export const metadata = { title: "Etiqueta simulada", robots: { index: false } };

type Party = { name: string; address: string; number: string; district: string; city: string; state_abbr: string; postal_code: string };

export default async function LabelSimulator({ params }: { params: Promise<{ id: string }> }) {
  if (!mocksEnabled()) notFound();
  const o = await meGetOrder((await params).id);
  if (!o) notFound();
  const from = o.body.from as Party;
  const to = o.body.to as Party;
  const line = (p: Party) => `${p.address}, ${p.number} — ${p.district}, ${p.city}/${p.state_abbr} — CEP ${p.postal_code}`;
  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="relative space-y-4 border-4 border-dashed border-danger bg-white p-6 font-mono text-sm">
        <p className="text-center text-lg font-bold text-danger">ETIQUETA SIMULADA — NÃO É VÁLIDA PARA POSTAGEM</p>
        <p>Protocolo: {o.protocol} · Serviço #{o.service} · Status: {o.status}</p>
        <div><p className="font-bold">DESTINATÁRIO</p><p>{to.name}</p><p>{line(to)}</p></div>
        <div><p className="font-bold">REMETENTE</p><p>{from.name}</p><p>{line(from)}</p></div>
        <p>Rastreio: {o.tracking ?? "(disponível após a postagem)"}</p>
      </div>
    </main>
  );
}
