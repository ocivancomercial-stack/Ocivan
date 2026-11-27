import { notFound } from "next/navigation";
import { ADMIN_LINKS } from "@/features/admin/admin-nav";
import { requireAdmin } from "@/lib/session";

export default async function AdminSectionPlaceholder({ params }: { params: Promise<{ section: string }> }) {
  await requireAdmin();
  const { section } = await params;
  const link = ADMIN_LINKS.find((l) => l.href === `/admin/${section}`);
  if (!link) notFound();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold">{link.label}</h1>
      <p className="text-muted">Em desenvolvimento — previsto para a Etapa 4.</p>
    </div>
  );
}
