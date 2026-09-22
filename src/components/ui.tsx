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
    "bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(245_65%_30%/0.35),inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:shadow-[0_4px_16px_-4px_hsl(245_65%_40%/0.5),inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:brightness-[1.06] active:brightness-95",
  secondary: "glass-inset text-secondary-foreground hover:bg-accent",
  outline:
    "glass text-secondary-foreground hover:brightness-[1.02] active:brightness-[0.98]",
  ghost: "hover:bg-accent/60 hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground shadow-[0_1px_2px_hsl(356_72%_35%/0.35),inset_0_1px_0_hsl(0_0%_100%/0.2)] hover:brightness-[1.06] active:brightness-95",
  success:
    "bg-emerald-600 text-white shadow-[0_1px_2px_hsl(160_84%_30%/0.35),inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:bg-emerald-500 active:brightness-95",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-[calc(var(--radius)-6px)] px-3 text-xs",
  md: "h-9.5 px-4 text-sm",
  lg: "h-11 rounded-[calc(var(--radius)-2px)] px-6 text-[15px]",
  icon: "h-9 w-9 rounded-[calc(var(--radius)-6px)]",
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
        "inline-flex select-none items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------- Input -------------------------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "glass-inset flex h-9.5 w-full rounded-[calc(var(--radius)-6px)] border-0 px-3 py-1 text-sm shadow-none outline-none transition duration-200 placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:bg-card/80 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

/* -------------------------------- Label -------------------------------- */

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-[13px] font-medium tracking-[-0.01em] text-foreground/90",
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
    default: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
    secondary: "glass-inset text-muted-foreground",
    outline: "ring-1 ring-inset ring-border text-foreground",
    success: "bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-600/25",
    warning: "bg-amber-500/14 text-amber-700 ring-1 ring-inset ring-amber-600/25",
    destructive: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.01em]",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/* --------------------------------- Card --------------------------------- */

/**
 * Glass panel. The element must be `relative` for the hairline gradient
 * border (::before) to position correctly.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass relative rounded-2xl text-card-foreground", className)}
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
      className={cn("font-semibold leading-none tracking-[-0.015em]", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
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
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="glass flex h-12 w-12 items-center justify-center rounded-2xl">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <p className="font-medium">{title}</p>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
