import Link from "next/link";
import { CATEGORY_ICONS } from "./category-icons";

export function CategoryGrid({ categories }: { categories: { name: string; slug: string }[] }) {
  return (
    <ul className="grid grid-cols-4 gap-3 md:gap-5">
      {categories.map((c) => {
        const Icon = CATEGORY_ICONS[c.slug];
        return (
          <li key={c.slug}>
            <Link
              href={`/buscar?categoria=${c.slug}`}
              className="group flex flex-col items-center gap-2 rounded-card bg-surface p-3 text-center shadow-card transition hover:-translate-y-0.5 md:p-6"
            >
              <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-900 transition group-hover:bg-brand group-hover:text-white md:size-16">
                {Icon && <Icon className="size-6 md:size-8" />}
              </span>
              <span className="text-xs font-bold md:text-base">{c.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
