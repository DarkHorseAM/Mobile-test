import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import * as React from "react";

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

export function Button({
  className,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 text-xs font-sans font-medium uppercase tracking-label transition-colors disabled:opacity-50 disabled:pointer-events-none border",
        variant === "default" &&
          "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
        variant === "outline" &&
          "bg-panel text-ink border-rule hover:border-accent",
        variant === "ghost" &&
          "bg-transparent text-ink border-transparent hover:text-accent",
        className,
      )}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full bg-panel border border-rule px-3 text-sm font-mono text-ink placeholder:text-muted focus:border-accent focus:outline-none",
        className,
      )}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("bg-panel border border-rule p-5", className)}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn(
        "block mb-1 text-[11px] font-sans font-medium uppercase tracking-label text-muted",
        className,
      )}
    />
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center border border-rule bg-panel px-2 py-0.5 text-[10px] font-sans font-medium uppercase tracking-label text-ink",
        className,
      )}
    />
  );
}
