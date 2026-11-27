"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Navegação inferior — apenas no celular (md:hidden). */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ...item }) => {
          const active = isActive(pathname, href);
          const highlight = "highlight" in item && item.highlight;
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  active ? "text-brand" : "text-muted",
                )}
              >
                {highlight ? (
                  <span className="-mt-6 grid size-13 place-items-center rounded-full bg-brand text-white shadow-float ring-4 ring-canvas">
                    <Icon className="size-6" strokeWidth={2.4} />
                  </span>
                ) : (
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                )}
                <span className={highlight ? "text-brand" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
