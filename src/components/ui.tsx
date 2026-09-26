import { cn } from "@/lib/utils";
import * as React from "react";

/* ------------------------------- Button ------------------------------- */

type ButtonVariant =
  | "default"
  | "outline"
  | "ghost"
  | "destructive"
  | "secondary"
  | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  default:
    "bg-[#165b33] text-white hover:bg-[#124929] shadow-sm dark:bg-[#20683f] dark:hover:bg-[#175231]",
  secondary:
    "border border-[#ded9ce] bg-[#f0ece4] text-[#1c2024] hover:bg-[#e6e1d6] dark:border-[#323d4c] dark:bg-[#232b36] dark:text-[#f0ede6] dark:hover:bg-[#2b3543]",
  outline:
    "border border-[#d8d3c7] bg-white text-[#1c2024] hover:bg-[#f7f5ef] dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6] dark:hover:bg-[#232b36]",
  ghost:
    "text-[#1c2024] hover:bg-[#f0ece4] dark:text-[#f0ede6] dark:hover:bg-[#232b36]",
  destructive:
    "bg-[#a82424] text-white hover:bg-[#8f1d1d] shadow-sm",
  success:
    "bg-[#165b33] text-white hover:bg-[#124929] shadow-sm",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
  md: "h-9 px-3.5 text-xs font-medium rounded-md",
  lg: "h-10 rounded-md px-5 text-sm font-medium",
  icon: "h-8 w-8 rounded-md",
};

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165b33]/50 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------- Input -------------------------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-[#d8d3c7] bg-white px-3 py-1.5 text-xs text-[#1c2024] shadow-none outline-none transition-colors placeholder:text-[#88909c] focus:border-[#165b33] focus:ring-1 focus:ring-[#165b33] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#333e4e] dark:bg-[#1b222c] dark:text-[#f0ede6]",
        className
      )}
      {...props}
    />
  );
});

/* -------------------------------- Label -------------------------------- */

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-xs font-semibold text-[#1c2024] dark:text-[#f0ede6]",
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------- Badge -------------------------------- */

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}) {
  const variants = {
    default: "bg-[#eaf4ed] text-[#165b33] border border-[#b8ddc4] dark:bg-[#143a24] dark:text-[#7fdca4] dark:border-[#215736]",
    secondary: "bg-[#f0ece4] text-[#474f5a] border border-[#ded9ce] dark:bg-[#232b36] dark:text-[#cbd5e1] dark:border-[#333e4e]",
    outline: "border border-[#d8d3c7] text-[#474f5a] dark:border-[#333e4e] dark:text-[#cbd5e1]",
    success: "bg-[#eaf4ed] text-[#165b33] border border-[#b8ddc4] dark:bg-[#143a24] dark:text-[#7fdca4] dark:border-[#215736]",
    warning: "bg-[#fef8ea] text-[#92540d] border border-[#f6e0ad] dark:bg-[#38280f] dark:text-[#f3b55c] dark:border-[#5c431a]",
    destructive: "bg-[#fdf0f0] text-[#a82424] border border-[#f8c4c4] dark:bg-[#3d1818] dark:text-[#f38d8d] dark:border-[#5e2626]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium tracking-tight",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/* --------------------------------- Card --------------------------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#e5e1d8] bg-white text-card-foreground shadow-sm dark:border-[#2a3341] dark:bg-[#1b222c]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-bold text-[#1c2024] dark:text-white leading-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-[#5c6470] dark:text-[#94a3b8] leading-relaxed", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/* ------------------------------ Empty state ----------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f0ece4] text-[#5c6470] dark:bg-[#232b36] dark:text-[#94a3b8]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-xs font-semibold text-[#1c2024] dark:text-white">{title}</p>
      {children ? <div className="text-xs text-[#5c6470] dark:text-[#94a3b8]">{children}</div> : null}
    </div>
  );
}
