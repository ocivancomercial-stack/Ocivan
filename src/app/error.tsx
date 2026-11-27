"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">Algo deu errado</h1>
      <p className="text-muted">Tivemos um problema ao carregar esta página. Tente novamente.</p>
      <Button onClick={reset}>Tentar de novo</Button>
    </main>
  );
}
