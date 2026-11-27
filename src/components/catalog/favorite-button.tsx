"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/features/favorites/actions";
import { cn } from "@/lib/utils";

export function FavoriteButton({ productId, initial, className, withLabel = false }: { productId: string; initial: boolean; className?: string; withLabel?: boolean }) {
  const [favorited, setOptimistic] = useOptimistic(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimistic(!favorited);
      const res = await toggleFavoriteAction(productId);
      if (!res.ok && res.reason === "auth") router.push(`/entrar?next=${encodeURIComponent(pathname)}`);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition",
        withLabel ? "h-11 border border-line bg-surface px-4 text-sm font-semibold hover:border-brand" : "size-9 bg-surface/90 shadow-card backdrop-blur hover:scale-105",
        className,
      )}
    >
      <Heart className={cn("size-5", favorited ? "fill-danger text-danger" : "text-ink")} />
      {withLabel && (favorited ? "Favoritado" : "Favoritar")}
    </button>
  );
}
