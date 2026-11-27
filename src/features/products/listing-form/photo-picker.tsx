"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Loader2, X } from "lucide-react";
import { compressImage } from "@/lib/client-image";
import { cn } from "@/lib/utils";

export type PhotoItem =
  | { kind: "existing"; id: string; url: string }
  | { kind: "new"; key: string; blob: Blob; url: string };

const MAX = 8;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif";

export function PhotoPicker({ photos, onChange, error }: { photos: PhotoItem[]; onChange: (p: PhotoItem[]) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string>();

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setLocalError(undefined);
    const room = MAX - photos.length;
    const selected = Array.from(files).slice(0, room);
    if (files.length > room) setLocalError(`Máximo de ${MAX} fotos por anúncio.`);
    setBusy(true);
    const added: PhotoItem[] = [];
    for (const file of selected) {
      if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
        setLocalError("Envie apenas imagens (JPG, PNG, WEBP ou HEIC).");
        continue;
      }
      const blob = await compressImage(file);
      if (blob.size > MAX_BYTES) {
        setLocalError("Uma das fotos passou de 8 MB e foi ignorada.");
        continue;
      }
      added.push({ kind: "new", key: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
    }
    setBusy(false);
    onChange([...photos, ...added]);
    if (input.current) input.current.value = "";
  }

  function remove(i: number) {
    const p = photos[i];
    if (p.kind === "new") URL.revokeObjectURL(p.url);
    onChange(photos.filter((_, j) => j !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const message = localError ?? error;
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.kind === "new" ? p.key : p.id} className="group relative aspect-square overflow-hidden rounded-field bg-brand-50">
            {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) */}
            <img src={p.url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Capa</span>}
            <button type="button" onClick={() => remove(i)} aria-label={`Remover foto ${i + 1}`} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-ink/70 text-white">
              <X className="size-4" />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para a esquerda" className="grid size-7 place-items-center rounded-full bg-surface/90 disabled:opacity-0">
                <ArrowLeft className="size-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label="Mover para a direita" className="grid size-7 place-items-center rounded-full bg-surface/90 disabled:opacity-0">
                <ArrowRight className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX && (
          <li className="aspect-square">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className={cn(
                "flex size-full flex-col items-center justify-center gap-1 rounded-field border-2 border-dashed text-sm font-semibold transition",
                message ? "border-danger text-danger" : "border-brand-100 text-brand hover:border-brand hover:bg-brand-50",
              )}
            >
              {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
              {busy ? "Preparando…" : photos.length === 0 ? "Adicionar fotos" : "Mais fotos"}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <p className="text-sm text-muted">
        {photos.length}/{MAX} fotos · A primeira é a capa. Use luz natural, fundo neutro e mostre etiquetas e defeitos.
      </p>
      {message && <p className="text-sm text-danger" role="alert">{message}</p>}
    </div>
  );
}
