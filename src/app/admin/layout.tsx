import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/features/admin/admin-nav";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: { default: "Administração", template: "%s · Admin Repassa Aí" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="space-y-6 bg-brand-900 p-4 md:min-h-dvh md:p-6">
        <Link href="/admin" className="block">
          <Logo inverted />
        </Link>
        <AdminNav />
        <p className="hidden text-xs text-white/50 md:block">Conectado como {admin.email}</p>
      </aside>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
