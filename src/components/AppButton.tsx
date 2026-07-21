import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80",
  secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  outline: "border border-border bg-background text-foreground hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-4 text-sm rounded-lg",
  lg: "h-12 px-5 text-base rounded-lg",
  xl: "h-14 px-6 text-base rounded-xl font-medium",
};

export const AppButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  ),
);
AppButton.displayName = "AppButton";
