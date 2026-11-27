/** Ícones lineares próprios das 4 categorias da v1 (estilo consistente com lucide). */
const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function ClothesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...common} d="M9 3.5a3 3 0 0 0 6 0l5 2.2 1.5 5-3 1.2V20.5H5.5v-8.6l-3-1.2L4 5.7z" />
    </svg>
  );
}
export function SneakerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...common} d="M2.5 16.5V9l4 1.5L9 7.5l3 3.5c2 2 5 2.5 7.5 3a2.5 2.5 0 0 1 2 2.5v.5H2.5zM2.5 19.5h19M11 10l-1.5 1.5M13 12l-1.5 1.5" />
    </svg>
  );
}
export function ShoeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...common} d="M3 18.5V8.5c3 0 4.5 1 6 3.5l3 3c1.5 1.3 4 1.3 6 1.6a2.6 2.6 0 0 1 2.5 1.9H3zM5 18.5v2" />
    </svg>
  );
}
export function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path {...common} d="M4.5 9h15l-1.2 11.5H5.7zM8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
    </svg>
  );
}

export const CATEGORY_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  roupas: ClothesIcon,
  tenis: SneakerIcon,
  sapatos: ShoeIcon,
  bolsas: BagIcon,
};
