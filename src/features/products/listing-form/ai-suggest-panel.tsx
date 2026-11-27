"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { suggestListingAction } from "../actions";
import type { ListingSuggestionResult } from "../ai-suggest";
import type { PhotoItem } from "./photo-picker";

type Field = "title" | "description" | "category" | "brand" | "color";

/**
 * Sugestões por IA a partir da foto de capa. Nada é aplicado sem o vendedor revisar e confirmar.
 * Tamanho e estado de conservação nunca são sugeridos.
 */
export function AiSuggestPanel({
  photo,
  labels,
  onApply,
}: {
  photo: PhotoItem | undefined;
  labels: { category: (id?: string) => string | undefined; brand: (id?: string) => string | undefined };
  onApply: (s: ListingSuggestionResult, fields: Set<Field>) => void;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ListingSuggestionResult>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<Field>>(new Set());

  function run() {
    if (!photo) return;
    setError(undefined);
    start(async () => {
      const blob = photo.kind === "new" ? photo.blob : await (await fetch(photo.url)).blob();
      const fd = new FormData();
      fd.set("photo", blob, "capa.jpg");
      const res = await suggestListingAction(fd);
      if (!res.ok) return setError(res.message);
      setResult(res.suggestion);
      const s = res.suggestion;
      setSelected(new Set<Field>([
        ...(s.title ? (["title"] as const) : []),
        ...(s.description ? (["description"] as const) : []),
        ...(s.categoryId ? (["category"] as const) : []),
        ...(s.brandId ? (["brand"] as const) : []),
        ...(s.color ? (["color"] as const) : []),
      ]));
    });
  }

  const rows: [Field, string, string | undefined][] = result
    ? [
        ["title", "Título", result.title],
        ["category", "Categoria", labels.category(result.categoryId)],
        ["brand", "Marca (logotipo visível)", labels.brand(result.brandId)],
        ["color", "Cor", result.color],
        ["description", "Descrição", result.description],
      ]
    : [];

  return (
    <div className="space-y-3 rounded-card border border-brand-100 bg-brand-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-900">
          <Sparkles className="size-4 text-brand" /> Preencher com ajuda da IA
        </p>
        <Button type="button" size="sm" variant="outline" onClick={run} disabled={pending || !photo}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? "Analisando a foto…" : result ? "Gerar de novo" : "Sugerir pela foto de capa"}
        </Button>
      </div>
      {!result && !error && <p className="text-xs text-muted">Usa a foto de capa para sugerir título, categoria, cor e descrição. Você revisa tudo antes.</p>}
      {error && <Alert tone="warning">{error}</Alert>}
      {result && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {rows.map(([field, label, value]) => (
              <li key={field}>
                <label className={`flex items-start gap-3 rounded-field bg-surface p-3 text-sm ${value ? "" : "opacity-60"}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brand"
                    disabled={!value}
                    checked={selected.has(field)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(field);
                      else next.delete(field);
                      setSelected(next);
                    }}
                  />
                  <span>
                    <span className="block text-xs text-muted">{label}</span>
                    <span className="block whitespace-pre-line">{value ?? "Não identificado na foto"}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {result.visibleFeatures.length > 0 && <p className="text-xs text-muted">Detalhes vistos: {result.visibleFeatures.join(", ")}</p>}
          <ul className="list-disc pl-5 text-xs text-[#7a5410]">
            {result.disclaimers.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <Button type="button" size="sm" disabled={selected.size === 0} onClick={() => { onApply(result, selected); setResult(undefined); }}>
            Aplicar selecionadas
          </Button>
        </div>
      )}
    </div>
  );
}
