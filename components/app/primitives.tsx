"use client";
import * as React from "react";
import { AlertCircle, Check, Copy, Inbox, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/client/utils";
import { money, statusMeta, type StatusTone } from "@/lib/client/format";

/* ---------- page chrome ---------- */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  flush,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Remove body padding (tables that run edge to edge). */
  flush?: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {title || actions ? (
        <div className="flex flex-col gap-2 px-5 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold leading-tight tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? "pb-1" : "px-5 pb-5", !title && !actions && !flush && "pt-5", contentClassName)}>{children}</div>
    </Card>
  );
}

/* ---------- numbers ---------- */

export function Money({ value, className, signed }: { value: unknown; className?: string; signed?: boolean }) {
  const n = Number(value) || 0;
  return (
    <span className={cn("num whitespace-nowrap", className)}>
      {signed && n > 0 ? "+" : ""}
      {money(n)}
    </span>
  );
}

const TONE_BG: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-secondary text-muted-foreground",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof TONE_BG;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE_BG[tone])}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className={cn("num mt-2 text-[22px] font-semibold leading-none tracking-tight sm:text-2xl", valueClassName)}>{value}</div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

/** A small label/value tile used inside cards. */
export function Tile({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "success" | "danger" | "primary" | "warning";
  className?: string;
}) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "";
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-3.5 py-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={cn("num mt-1 text-lg font-semibold leading-tight tracking-tight", color)}>{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function KeyValue({ rows, className }: { rows: { label: React.ReactNode; value: React.ReactNode; hide?: boolean }[]; className?: string }) {
  return (
    <dl className={cn("divide-y text-[13px]", className)}>
      {rows
        .filter((r) => !r.hide)
        .map((r, i) => (
          <div key={i} className="flex items-start justify-between gap-6 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="num text-right font-medium">{r.value}</dd>
          </div>
        ))}
    </dl>
  );
}

/* ---------- status ---------- */

const TONE_VARIANT: Record<StatusTone, "success" | "warning" | "danger" | "info" | "neutral"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "neutral",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const m = statusMeta(status);
  return (
    <Badge variant={TONE_VARIANT[m.tone]} dot className={className}>
      {m.label}
    </Badge>
  );
}

/* ---------- empty / error / loading ---------- */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  text,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  text?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", error, onRetry }: { title?: string; error?: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      text={message}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${96 - i * 14}%` }} />
        ))}
      </div>
    </Card>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-28" />
          <Skeleton className="mt-3 h-3 w-32" />
        </Card>
      ))}
    </div>
  );
}

/* ---------- forms ---------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ---------- small utilities ---------- */

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" className={className} onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Toggle theme">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        toast.error("Couldn't copy", { description: "Copy the number manually." });
        ta.remove();
        return;
      }
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={copy}>
      {done ? <Check /> : <Copy />}
      {done ? "Copied" : label}
    </Button>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  const text = ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || "")).toUpperCase();
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary", className)}>{text}</span>
  );
}
