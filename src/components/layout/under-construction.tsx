import { Hammer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * Página ainda não implementada. Exibida de forma explícita para não simular funcionalidade inexistente.
 */
export function UnderConstruction({ title, stage, description }: { title: string; stage: number; description: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-accent-50 text-accent">
        <Hammer className="size-8" />
      </span>
      <h1 className="mt-6 text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted">{description}</p>
      <p className="mt-4 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
        Em desenvolvimento — previsto para a Etapa {stage}
      </p>
      <ButtonLink href="/" variant="outline" className="mt-8">
        Voltar ao início
      </ButtonLink>
    </div>
  );
}
