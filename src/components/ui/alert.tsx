import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: "bg-brand-50 text-brand-900 border-brand-100",
  success: "bg-brand-50 text-brand-900 border-brand-100",
  warning: "bg-accent-50 text-[#7a5410] border-accent/40",
  error: "bg-danger-50 text-danger border-danger/30",
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-field border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
