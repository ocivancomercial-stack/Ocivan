"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCartAction } from "./actions";

export function BuyButtons({ productId }: { productId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>();

  function add(buyNow: boolean) {
    setMessage(undefined);
    start(async () => {
      const res = await addToCartAction(productId);
      if (!res.ok) {
        if (res.reason === "auth") router.push(`/entrar?next=${encodeURIComponent(pathname)}`);
        else setMessage(res.message);
        return;
      }
      if (buyNow) router.push(`/checkout?vendedor=${res.sellerId}`);
      else setMessage("Adicionado ao carrinho.");
    });
  }

  return (
    <div className="flex-1 space-y-2">
      <div className="flex gap-2">
        <Button size="lg" className="flex-1" onClick={() => add(true)} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Comprar agora
        </Button>
        <Button size="lg" variant="outline" onClick={() => add(false)} disabled={pending} aria-label="Adicionar ao carrinho">
          <ShoppingBag className="size-5" />
        </Button>
      </div>
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
    </div>
  );
}
