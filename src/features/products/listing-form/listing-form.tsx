"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SERVED_CITY_NAMES } from "@/lib/regions";
import { cn, formatBRL, parseBRLToCents } from "@/lib/utils";
import { productDetailsSchema, productPriceSchema } from "@/schemas/product";
import { COLORS, CONDITION_LABEL, CONDITION_OPTIONS, SIZE_SUGGESTIONS } from "../constants";
import { saveListingAction } from "../actions";
import { PhotoPicker, type PhotoItem } from "./photo-picker";
import { AiSuggestPanel } from "./ai-suggest-panel";

type Category = { id: string; name: string; slug: string; children: { id: string; name: string; slug: string }[] };
type Brand = { id: string; name: string };
export type ListingValues = {
  title: string; categoryId: string; brandId: string; size: string; color: string; condition: string;
  description: string; defects: string; price: string; city: string; shippingAvailable: boolean; localPickup: boolean;
};
type Errors = Record<string, string[] | undefined>;

const STEPS = ["Fotos", "Detalhes", "Preço e entrega", "Revisar"] as const;
const STEP_OF_FIELD: Record<string, number> = {
  photos: 0, title: 1, categoryId: 1, brandId: 1, size: 1, color: 1, condition: 1, description: 1, defects: 1,
  price: 2, city: 2, shippingAvailable: 2, localPickup: 2,
};

export function ListingForm({
  categories, brands, feeBps, initial, initialPhotos = [], productId, productStatus, defaultCity, aiEnabled = false,
}: {
  categories: Category[]; brands: Brand[]; feeBps: number; initial?: ListingValues; initialPhotos?: PhotoItem[];
  productId?: string; productStatus?: string; defaultCity: string; aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [v, setV] = useState<ListingValues>(
    initial ?? { title: "", categoryId: "", brandId: "", size: "", color: "", condition: "", description: "", defects: "", price: "", city: defaultCity, shippingAvailable: true, localPickup: false },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ListingValues>(k: K, value: ListingValues[K]) => {
    setV((old) => ({ ...old, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const rootOf = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => c.children.forEach((s) => map.set(s.id, c)));
    return map;
  }, [categories]);
  const [rootId, setRootId] = useState(() => (initial?.categoryId ? rootOf.get(initial.categoryId)?.id ?? "" : ""));
  const root = categories.find((c) => c.id === rootId);
  const sub = root?.children.find((s) => s.id === v.categoryId);

  const priceCents = parseBRLToCents(v.price) ?? 0;
  const fee = Math.round((priceCents * feeBps) / 10000);

  function validateStep(s: number): boolean {
    let errs: Errors = {};
    if (s === 0 && photos.length === 0) errs.photos = ["Adicione pelo menos uma foto"];
    if (s === 1) {
      const r = productDetailsSchema.safeParse({ ...v, brandId: v.brandId || undefined, defects: v.defects || undefined });
      if (!r.success) r.error.issues.forEach((i) => ((errs[String(i.path[0])] ??= []).push(i.message)));
    }
    if (s === 2) {
      const r = productPriceSchema.safeParse(v);
      if (!r.success) r.error.issues.forEach((i) => ((errs[String(i.path[0])] ??= []).push(i.message)));
      if (!v.shippingAvailable && !v.localPickup) errs.shippingAvailable = ["Escolha ao menos uma forma de entrega"];
    }
    errs = Object.fromEntries(Object.entries(errs).filter(([, m]) => m?.length));
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function submit(intent: "draft" | "publish" | "save") {
    if (intent !== "draft" && ![0, 1, 2].every((s) => validateStep(s))) {
      const first = [0, 1, 2].find((s) => !validateStep(s));
      if (first !== undefined) setStep(first);
      return;
    }
    setMessage(undefined);
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.set(k, String(val)));
    fd.set("intent", intent);
    if (productId) fd.set("productId", productId);
    const order: string[] = [];
    let n = 0;
    for (const p of photos) {
      if (p.kind === "existing") order.push(`existing:${p.id}`);
      else {
        fd.append("photos", p.blob, `foto-${n}.jpg`);
        order.push(`new:${n++}`);
      }
    }
    fd.set("imageOrder", JSON.stringify(order));

    startTransition(async () => {
      const res = await saveListingAction(fd);
      if (res.ok) {
        router.push(`/vender/anuncios?salvo=${res.productId}&status=${res.status}`);
        return;
      }
      setErrors(res.errors ?? {});
      setMessage(res.message ?? "Revise os campos destacados.");
      const firstField = Object.keys(res.errors ?? {})[0];
      if (firstField && STEP_OF_FIELD[firstField] !== undefined) setStep(STEP_OF_FIELD[firstField]);
    });
  }

  const e = (k: string) => errors[k]?.[0];
  const isDraft = !productId || productStatus === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Progresso */}
      <ol className="flex gap-2" aria-label="Etapas do anúncio">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => (i < step ? setStep(i) : undefined)}
              className={cn("w-full text-left", i < step && "cursor-pointer")}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
              <span className={cn("mt-1.5 hidden text-xs font-semibold sm:block", i === step ? "text-brand" : "text-muted")}>{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <h2 className="text-lg font-bold sm:hidden">
        {step + 1}. {STEPS[step]}
      </h2>

      {message && <Alert tone="error">{message}</Alert>}

      {step === 0 && <PhotoPicker photos={photos} onChange={(p) => { setPhotos(p); setErrors((x) => ({ ...x, photos: undefined })); }} error={e("photos")} />}

      {step === 1 && (
        <div className="space-y-4">
          {aiEnabled && (
            <AiSuggestPanel
              photo={photos[0]}
              labels={{
                category: (id) => {
                  const r = id ? rootOf.get(id) : undefined;
                  return r ? `${r.name} › ${r.children.find((c) => c.id === id)?.name}` : undefined;
                },
                brand: (id) => brands.find((b) => b.id === id)?.name,
              }}
              onApply={(sug, fields) => {
                if (fields.has("title") && sug.title) set("title", sug.title);
                if (fields.has("description") && sug.description) set("description", sug.description);
                if (fields.has("category") && sug.categoryId && sug.rootCategoryId) {
                  setRootId(sug.rootCategoryId);
                  set("categoryId", sug.categoryId);
                }
                if (fields.has("brand") && sug.brandId) set("brandId", sug.brandId);
                if (fields.has("color") && sug.color) set("color", sug.color);
              }}
            />
          )}
          <Field label="Título" name="title" error={errors.title} hint="Ex.: Jaqueta jeans Levi's azul clara">
            <Input name="title" value={v.title} maxLength={80} onChange={(x) => set("title", x.target.value)} invalid={!!e("title")} />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Categoria</legend>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setRootId(c.id); set("categoryId", ""); set("size", ""); }}
                  className={cn("rounded-field border px-2 py-3 text-sm font-semibold", rootId === c.id ? "border-brand bg-brand-50 text-brand-900" : "border-line bg-surface")}
                  aria-pressed={rootId === c.id}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
          {root && (
            <Field label="Subcategoria" name="categoryId" error={errors.categoryId}>
              <Select name="categoryId" value={v.categoryId} onChange={(x) => set("categoryId", x.target.value)} invalid={!!e("categoryId")}>
                <option value="">Selecione…</option>
                {root.children.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          {!root && e("categoryId") && <p className="text-sm text-danger">{e("categoryId")}</p>}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marca" name="brandId" error={errors.brandId}>
              <Select name="brandId" value={v.brandId} onChange={(x) => set("brandId", x.target.value)}>
                <option value="">Sem marca / outra</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Tamanho" name="size" error={errors.size}>
              <Input name="size" list="size-options" value={v.size} maxLength={12} onChange={(x) => set("size", x.target.value)} invalid={!!e("size")} placeholder={root?.slug === "bolsas" ? "Único" : "M, 38…"} />
              <datalist id="size-options">{(SIZE_SUGGESTIONS[root?.slug ?? "roupas"] ?? []).map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Cor" name="color" error={errors.color}>
              <Select name="color" value={v.color} onChange={(x) => set("color", x.target.value)} invalid={!!e("color")}>
                <option value="">Selecione…</option>
                {COLORS.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Estado de conservação</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONDITION_OPTIONS.map((c) => (
                <label key={c.value} className={cn("flex cursor-pointer items-start gap-3 rounded-field border p-3", v.condition === c.value ? "border-brand bg-brand-50" : "border-line bg-surface")}>
                  <input type="radio" name="condition" value={c.value} checked={v.condition === c.value} onChange={() => set("condition", c.value)} className="mt-1 accent-brand" />
                  <span>
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className="block text-xs text-muted">{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {e("condition") && <p className="text-sm text-danger" role="alert">{e("condition")}</p>}
          </fieldset>

          <Field label="Descrição" name="description" error={errors.description} hint={`${v.description.length}/2000 · Conte medidas, tecido, como serviu, motivo da venda.`}>
            <Textarea name="description" value={v.description} maxLength={2000} rows={5} onChange={(x) => set("description", x.target.value)} invalid={!!e("description")} />
          </Field>
          <Field label="Defeitos (opcional)" name="defects" error={errors.defects} hint="Seja transparente: manchas, desgastes, costuras. Evita devoluções.">
            <Textarea name="defects" value={v.defects} maxLength={500} rows={2} onChange={(x) => set("defects", x.target.value)} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field label="Preço (R$)" name="price" error={errors.price}>
            <Input name="price" inputMode="decimal" placeholder="0,00" value={v.price} onChange={(x) => set("price", x.target.value)} invalid={!!e("price")} className="text-2xl font-extrabold" />
          </Field>
          {priceCents > 0 && (
            <div className="rounded-field bg-brand-50 p-4 text-sm text-brand-900">
              <div className="flex justify-between"><span>Preço do produto</span><span>{formatBRL(priceCents)}</span></div>
              <div className="flex justify-between"><span>Comissão Repassa Aí ({(feeBps / 100).toLocaleString("pt-BR")}%)</span><span>− {formatBRL(fee)}</span></div>
              <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-bold"><span>Você recebe (estimativa)</span><span>{formatBRL(priceCents - fee)}</span></div>
              <p className="mt-2 text-xs text-brand-900/70">Antes das taxas do provedor de pagamento. O frete é pago pelo comprador e não entra na comissão.</p>
            </div>
          )}
          <Field label="Cidade do produto" name="city" error={errors.city} hint="Mostramos apenas a cidade — nunca seu endereço.">
            <Select name="city" value={v.city} onChange={(x) => set("city", x.target.value)}>
              {SERVED_CITY_NAMES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Formas de entrega</legend>
            <label className="flex items-center gap-3 rounded-field border border-line bg-surface p-3 text-sm">
              <input type="checkbox" checked={v.shippingAvailable} onChange={(x) => set("shippingAvailable", x.target.checked)} className="size-5 accent-brand" />
              Envio pelos Correios/transportadora (etiqueta pela plataforma)
            </label>
            <label className="flex items-center gap-3 rounded-field border border-line bg-surface p-3 text-sm">
              <input type="checkbox" checked={v.localPickup} onChange={(x) => set("localPickup", x.target.checked)} className="size-5 accent-brand" />
              Entrega/retirada combinada na cidade
            </label>
            {e("shippingAvailable") && <p className="text-sm text-danger" role="alert">{e("shippingAvailable")}</p>}
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local
              <img key={i} src={p.url} alt={`Foto ${i + 1}`} className="size-24 shrink-0 rounded-field object-cover" />
            ))}
          </div>
          <dl className="divide-y divide-line rounded-card bg-surface text-sm shadow-card">
            {[
              ["Título", v.title],
              ["Categoria", `${root?.name ?? ""} › ${sub?.name ?? ""}`],
              ["Marca", brands.find((b) => b.id === v.brandId)?.name ?? "Sem marca / outra"],
              ["Tamanho", v.size],
              ["Cor", v.color],
              ["Estado", CONDITION_LABEL[v.condition as keyof typeof CONDITION_LABEL] ?? ""],
              ["Preço", formatBRL(priceCents)],
              ["Cidade", v.city],
              ["Entrega", [v.shippingAvailable && "Envio", v.localPickup && "Retirada na cidade"].filter(Boolean).join(" e ")],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-semibold">{val}</dd>
              </div>
            ))}
            <div className="px-4 py-3">
              <dt className="text-muted">Descrição</dt>
              <dd className="mt-1 whitespace-pre-line">{v.description}</dd>
              {v.defects && <dd className="mt-2 text-danger">Defeitos: {v.defects}</dd>}
            </div>
          </dl>
          <p className="text-xs text-muted">
            Ao publicar, você confirma que o produto é seu, é original e está de acordo com a Política de anúncios proibidos.
          </p>
        </div>
      )}

      {/* Navegação */}
      <div className="sticky bottom-20 z-10 flex gap-2 rounded-card bg-canvas/95 py-2 backdrop-blur md:bottom-0">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={pending} aria-label="Voltar">
            <ChevronLeft className="size-4" />
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1" onClick={next}>
            Continuar
          </Button>
        ) : (
          <>
            {isDraft && (
              <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={pending}>
                Salvar rascunho
              </Button>
            )}
            <Button type="button" className="flex-1" onClick={() => submit(isDraft ? "publish" : "save")} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {pending ? "Enviando…" : isDraft ? "Publicar anúncio" : "Salvar alterações"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
