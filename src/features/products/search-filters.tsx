import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SERVED_CITY_NAMES } from "@/lib/regions";
import type { SearchFilters } from "@/schemas/product";
import { CONDITION_OPTIONS, DISTANCE_OPTIONS, SORT_OPTIONS } from "./constants";

type Category = { name: string; slug: string; children: { name: string; slug: string }[] };

/**
 * Filtros como formulário GET: cada filtro vira parâmetro da URL e é aplicado NO BANCO
 * (src/features/products/queries.ts). Funciona sem JavaScript e gera URLs compartilháveis.
 */
export function SearchFiltersForm({ filters, categories, brands, viewerCity }: { filters: SearchFilters; categories: Category[]; brands: { name: string; slug: string }[]; viewerCity?: string | null }) {
  const root = categories.find((c) => c.slug === filters.categoria) ?? categories.find((c) => c.children.some((s) => s.slug === filters.subcategoria));
  const activeCount = ["categoria", "subcategoria", "marca", "tamanho", "estado", "precoMin", "precoMax", "cidade", "distancia"].filter((k) => filters[k as keyof SearchFilters] !== undefined).length;

  return (
    <details className="group rounded-card bg-surface shadow-card md:open:bg-surface" open={activeCount > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-semibold">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-brand" /> Filtros {activeCount > 0 && <span className="rounded-full bg-brand px-2 text-xs text-white">{activeCount}</span>}
        </span>
        <span className="text-sm text-brand group-open:hidden">Mostrar</span>
        <span className="hidden text-sm text-brand group-open:inline">Ocultar</span>
      </summary>
      <form action="/buscar" method="get" className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        <Field label="Categoria" name="categoria">
          <Select name="categoria" defaultValue={root?.slug ?? ""}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Subcategoria" name="subcategoria">
          <Select name="subcategoria" defaultValue={filters.subcategoria ?? ""}>
            <option value="">Todas</option>
            {(root ? [root] : categories).map((c) => (
              <optgroup key={c.slug} label={c.name}>
                {c.children.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Marca" name="marca">
          <Select name="marca" defaultValue={filters.marca ?? ""}>
            <option value="">Todas</option>
            {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Tamanho" name="tamanho">
          <Input name="tamanho" defaultValue={filters.tamanho} placeholder="Ex.: M, 38" maxLength={12} />
        </Field>
        <Field label="Estado de conservação" name="estado">
          <Select name="estado" defaultValue={filters.estado ?? ""}>
            <option value="">Qualquer</option>
            {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Preço mín. (R$)" name="precoMin">
            <Input name="precoMin" type="number" min={0} inputMode="numeric" defaultValue={filters.precoMin} />
          </Field>
          <Field label="Preço máx. (R$)" name="precoMax">
            <Input name="precoMax" type="number" min={0} inputMode="numeric" defaultValue={filters.precoMax} />
          </Field>
        </div>
        <Field label="Cidade" name="cidade">
          <Select name="cidade" defaultValue={filters.cidade ?? ""}>
            <option value="">Todas</option>
            {SERVED_CITY_NAMES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Distância" name="distancia">
            <Select name="distancia" defaultValue={filters.distancia ? String(filters.distancia) : ""}>
              <option value="">Qualquer</option>
              {DISTANCE_OPTIONS.map((d) => <option key={d} value={d}>até {d} km</option>)}
            </Select>
          </Field>
          <Field label="A partir de" name="perto">
            <Select name="perto" defaultValue={filters.perto ?? viewerCity ?? "Curitiba"}>
              {SERVED_CITY_NAMES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Ordenar por" name="ordem">
          <Select name="ordem" defaultValue={filters.ordem}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
          <Link href={filters.q ? `/buscar?q=${encodeURIComponent(filters.q)}` : "/buscar"} className={buttonClasses("ghost")}>Limpar</Link>
          <button type="submit" className={buttonClasses("primary", "md", "flex-1 lg:flex-none")}>Aplicar filtros</button>
        </div>
        <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">Distância aproximada entre os centros das cidades — nunca usamos o endereço de ninguém.</p>
      </form>
    </details>
  );
}
