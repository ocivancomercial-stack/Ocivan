import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, MapPin, Package, ShieldCheck, Star, Store, Tag, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOutAction } from "@/features/auth/actions";
import { deleteAddressAction, setDefaultAddressAction } from "@/features/profile/actions";
import { AddressForm } from "@/features/profile/address-form";
import { AvatarForm } from "@/features/profile/avatar-form";
import { ProfileForm } from "@/features/profile/profile-form";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { maskCpf } from "@/lib/cpf";

export const metadata: Metadata = { title: "Meu perfil", robots: { index: false } };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("/perfil");
  const { bemvindo } = await searchParams;
  const { cpf } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { cpf: true } });
  const [addresses, ratings] = await Promise.all([
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.review.aggregate({ where: { reviewedUserId: user.id }, _avg: { rating: true }, _count: true }),
  ]);

  const shortcuts = [
    { href: "/vender/anuncios", label: "Meus anúncios", icon: Tag },
    { href: "/perfil/compras", label: "Minhas compras", icon: Package },
    { href: "/perfil/vendas", label: "Painel do vendedor", icon: Store },
    { href: "/perfil/recebimentos", label: "Recebimentos", icon: Wallet },
    { href: "/privacidade/meus-dados", label: "Meus dados (LGPD)", icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {bemvindo && <Alert tone="success">Conta criada! Complete seu endereço para comprar com mais rapidez.</Alert>}

      <div className="flex items-center gap-4">
        <AvatarForm name={user.name} avatar={user.avatar} />
        <div>
          <h1 className="text-2xl font-extrabold">{user.name}</h1>
          <p className="text-sm text-muted">
            {user.email} · {user.city ?? "Cidade não informada"}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <Star className="size-4 fill-accent text-accent" />
            {ratings._count > 0 ? `${ratings._avg.rating?.toFixed(1)} (${ratings._count} avaliações)` : "Ainda sem avaliações"}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shortcuts.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card hover:ring-2 hover:ring-brand-100">
              <s.icon className="size-5 text-brand" />
              <span className="text-sm font-semibold">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-bold">Dados pessoais</h2>
        <ProfileForm user={user} cpfMasked={cpf ? maskCpf(cpf) : null} />
      </Card>

      <Card id="enderecos" className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MapPin className="size-5 text-brand" /> Endereços de entrega
        </h2>
        <p className="text-sm text-muted">Seu endereço nunca é exibido publicamente — só é usado para a entrega das suas compras.</p>
        {addresses.length > 0 && (
          <ul className="divide-y divide-line rounded-field border border-line">
            {addresses.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold">
                    {a.street}, {a.number}
                    {a.complement ? ` — ${a.complement}` : ""}{" "}
                    {a.isDefault && <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900">Principal</span>}
                  </p>
                  <p className="text-muted">
                    {a.neighborhood}, {a.city}/{a.state} · CEP {a.postalCode.replace(/(\d{5})(\d{3})/, "$1-$2")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!a.isDefault && (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="ghost" size="sm">Tornar principal</Button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button variant="ghost" size="sm" className="text-danger">Remover</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddressForm />
      </Card>

      <form action={signOutAction}>
        <Button variant="outline" className="w-full">
          <LogOut className="size-4" /> Sair da conta
        </Button>
      </form>
    </div>
  );
}
