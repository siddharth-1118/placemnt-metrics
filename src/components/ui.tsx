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
    "bg-gradient-to-b from-[hsl(260_95%_68%)] to-[hsl(255_85%_58%)] text-white shadow-[0_2px_12px_-2px_hsl(258_90%_60%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.35)] hover:shadow-[0_6px_28px_-4px_hsl(258_95%_62%/0.65),inset_0_1px_0_hsl(0_0%_100%/0.35)] hover:brightness-[1.07] active:brightness-95",
  secondary: "glass-inset text-secondary-foreground hover:bg-white/10",
  outline:
    "glass text-foreground/90 hover:brightness-[1.15] active:brightness-[0.97]",
  ghost: "hover:bg-white/8 hover:text-foreground",
  destructive:
    "bg-gradient-to-b from-[hsl(352_85%_62%)] to-[hsl(350_80%_52%)] text-white shadow-[0_2px_12px_-2px_hsl(352_80%_55%/0.5),inset_0_1px_0_hsl(0_0%_100%/0.3)] hover:brightness-[1.07] active:brightness-95",
  success:
    "bg-gradient-to-b from-[hsl(160_85%_46%)] to-[hsl(158_80%_38%)] text-white shadow-[0_2px_12px_-2px_hsl(160_84%_40%/0.5),inset_0_1px_0_hsl(0_0%_100%/0.3)] hover:brightness-[1.07] active:brightness-95",
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
          "glass-inset flex h-9.5 w-full rounded-[calc(var(--radius)-6px)] border-0 px-3 py-1 text-sm text-foreground shadow-none outline-none transition duration-200 placeholder:text-muted-foreground/60 focus-visible:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
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
        "text-[13px] font-medium tracking-[-0.01em] text-foreground/80",
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
    default: "bg-primary/15 text-[hsl(258_100%_82%)] ring-1 ring-inset ring-primary/35",
    secondary: "glass-inset text-muted-foreground",
    outline: "ring-1 ring-inset ring-white/15 text-foreground/90",
    success: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
    warning: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/30",
    destructive: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30",
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
