import { Alert } from "@/components/ui/alert";

export type LegalSection = { title: string; paragraphs: string[] };

export function LegalPage({ title, updatedAt, sections }: { title: string; updatedAt: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold text-brand-900">{title}</h1>
        <p className="text-sm text-muted">Última atualização: {updatedAt}</p>
      </header>
      <Alert tone="warning">
        <strong>Texto provisório, sujeito à revisão jurídica.</strong> Este documento ainda não foi revisado por advogado e
        não representa certificação de conformidade legal (LGPD, CDC ou Marco Civil da Internet).
      </Alert>
      {sections.map((s, i) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-bold">
            {i + 1}. {s.title}
          </h2>
          {s.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="leading-relaxed text-ink/85">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
