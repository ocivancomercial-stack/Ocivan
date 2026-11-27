"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Galeria com deslize (scroll-snap) no celular e miniaturas no desktop. */
export function Gallery({ images, title }: { images: { id: string; imageUrl: string }[]; title: string }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  function go(i: number) {
    setActive(i);
    track.current?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }

  function onScroll() {
    const el = track.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (images.length === 0) return <div className="grid aspect-[4/5] place-items-center rounded-card bg-brand-50 text-muted">Sem fotos</div>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div ref={track} onScroll={onScroll} className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto rounded-card bg-brand-50 [scrollbar-width:none]">
          {images.map((img, i) => (
            <div key={img.id} className="relative w-full shrink-0 snap-start">
              <Image src={img.imageUrl} alt={`${title} — foto ${i + 1}`} fill priority={i === 0} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white">
            {active + 1}/{images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="hidden gap-2 md:flex">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => go(i)} aria-label={`Ver foto ${i + 1}`} className={cn("relative size-16 overflow-hidden rounded-field ring-2", i === active ? "ring-brand" : "ring-transparent")}>
              <Image src={img.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
