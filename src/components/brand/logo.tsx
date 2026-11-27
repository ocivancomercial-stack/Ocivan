import { cn } from "@/lib/utils";

/**
 * Símbolo provisório: um cabide cuja base é formada por duas setas em ciclo
 * (circularidade + reutilização + moda).
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden="true">
      <rect width="40" height="40" rx="12" fill={inverted ? "var(--color-brand)" : "var(--color-brand-900)"} />
      {/* gancho do cabide */}
      <path d="M20 13.5v-1.2a2.6 2.6 0 1 0-2.6-2.6" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" />
      {/* ombros do cabide formados por setas em ciclo */}
      <path d="M20 14.2 9.6 23.4a2.4 2.4 0 0 0 1.6 4.2H19" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 14.2l10.4 9.2a2.4 2.4 0 0 1-1.6 4.2H24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.6 25.2 19.2 27.6 16.6 30" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26.4 25.2 23.8 27.6 26.4 30" fill="none" stroke="var(--color-brand-100)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark inverted={inverted} />
      <span className={cn("text-xl font-extrabold tracking-tight", inverted ? "text-white" : "text-brand-900")}>
        Repassa<span className="text-brand"> Aí</span>
      </span>
    </span>
  );
}
