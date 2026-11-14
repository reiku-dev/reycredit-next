import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/client/utils";

const alertVariants = cva("relative flex w-full gap-3 rounded-lg border p-3.5 text-[13px] leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      info: "border-info/25 bg-info/[0.07] text-foreground [&>svg]:text-info",
      success: "border-success/25 bg-success/[0.07] text-foreground [&>svg]:text-success",
      warning: "border-warning/30 bg-warning/[0.08] text-foreground [&>svg]:text-warning",
      danger: "border-destructive/25 bg-destructive/[0.06] text-foreground [&>svg]:text-destructive",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle } as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { Alert };
