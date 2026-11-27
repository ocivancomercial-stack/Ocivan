"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductStatus } from "@prisma/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { changeListingStatusAction } from "./actions";
import { canOwner } from "./status";

export function ListingActions({ productId, status }: { productId: string; status: ProductStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  function run(action: "publish" | "pause" | "reactivate" | "remove") {
    if (action === "remove" && !confirm("Excluir este anúncio? Ele deixará de aparecer para compradores.")) return;
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("action", action);
    start(async () => {
      const res = await changeListingStatusAction(fd);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {canOwner("edit", status) && <ButtonLink href={`/vender/anuncios/${productId}/editar`} variant="outline" size="sm">Editar</ButtonLink>}
        {canOwner("publish", status) && <Button size="sm" onClick={() => run("publish")} disabled={pending}>Publicar</Button>}
        {canOwner("pause", status) && <Button size="sm" variant="outline" onClick={() => run("pause")} disabled={pending}>Pausar</Button>}
        {canOwner("reactivate", status) && <Button size="sm" onClick={() => run("reactivate")} disabled={pending}>Reativar</Button>}
        {canOwner("remove", status) && <Button size="sm" variant="ghost" className="text-danger" onClick={() => run("remove")} disabled={pending}>Excluir</Button>}
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
