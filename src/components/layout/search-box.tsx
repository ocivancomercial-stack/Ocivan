import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Busca via GET /buscar?q= — funciona sem JavaScript e é indexável. */
export function SearchBox({ className, size = "md", defaultValue }: { className?: string; size?: "md" | "lg"; defaultValue?: string }) {
  return (
    <form action="/buscar" method="get" role="search" className={cn("relative w-full", className)}>
      <label htmlFor={`q-${size}`} className="sr-only">
        Buscar produtos
      </label>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        id={`q-${size}`}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={100}
        placeholder="Buscar tênis, jaquetas, bolsas…"
        className={cn(
          "w-full rounded-full border border-line bg-surface pl-12 pr-4 text-ink placeholder:text-muted outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-50",
          size === "lg" ? "h-14 text-base shadow-card" : "h-11 text-sm",
        )}
      />
    </form>
  );
}
