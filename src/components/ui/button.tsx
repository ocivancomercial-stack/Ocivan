import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 select-none";

const variants = {
  primary: "bg-brand text-white hover:bg-brand-700 active:bg-brand-900",
  dark: "bg-brand-900 text-white hover:bg-brand-700",
  accent: "bg-accent text-brand-900 hover:brightness-95",
  outline: "border border-line bg-surface text-ink hover:border-brand hover:text-brand",
  ghost: "text-ink hover:bg-brand-50",
  danger: "bg-danger text-white hover:brightness-95",
} as const;

const sizes = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-sm", lg: "h-13 px-7 text-base" } as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
