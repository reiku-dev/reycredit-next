"use client";
import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CardSkeleton, ErrorState, SectionCard } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCreditScore } from "@/lib/client/queries";
import { cn } from "@/lib/client/utils";

export function gradeTone(tone: string | undefined) {
  return tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-muted-foreground";
}

export function ScoreCard({ email }: { email: string }) {
  const { data, isLoading, error, refetch } = useCreditScore(email);
  if (isLoading) return <CardSkeleton rows={4} />;
  if (error) {
    return (
      <SectionCard title="Payment record">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </SectionCard>
    );
  }
  if (!data) return null;
  if (!data.scored) {
    return (
      <SectionCard title="Payment record" description="Scored from how on time each billed cycle was paid.">
        <p className="text-sm text-muted-foreground">No billed cycles yet, so there is nothing to score.</p>
      </SectionCard>
    );
  }
  const d = data;
  return (
    <SectionCard
      title="Payment record"
      description={`${d.cycles} billed ${d.cycles === 1 ? "cycle" : "cycles"}, ${d.onTimeCount} paid on time`}
      actions={d.thin ? <Badge variant="neutral">Short history</Badge> : undefined}
    >
      <div className="flex items-center gap-4">
        <div className={cn("grid size-16 shrink-0 place-items-center rounded-2xl border-2 text-3xl font-bold", d.thin ? "border-muted text-muted-foreground" : "border-current " + gradeTone(d.tone))}>{d.thin ? "—" : d.grade}</div>
        <div className="min-w-0">
          <p className="num text-2xl font-semibold leading-none">
            {d.score}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{d.thin ? "Building history" : d.label}</p>
          {d.trend ? (
            <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", d.trend.direction === "improving" ? "text-success" : d.trend.direction === "slipping" ? "text-destructive" : "text-muted-foreground")}>
              {d.trend.direction === "improving" ? <TrendingUp className="size-3.5" /> : d.trend.direction === "slipping" ? <TrendingDown className="size-3.5" /> : null}
              {d.trend.direction === "improving" ? "Improving" : d.trend.direction === "slipping" ? "Slipping" : "Steady"}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {(d.factors ?? []).map((f) => (
          <div key={f.key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="num font-medium">{f.value}%</span>
            </div>
            <Progress value={f.value} className="h-1.5" />
          </div>
        ))}
      </div>
      {(d.reasons ?? []).length ? (
        <ul className="mt-5 space-y-1.5 border-t pt-4 text-[13px]">
          {(d.reasons ?? []).slice(0, 6).map((r, i) => (
            <li key={i} className={cn("flex gap-2", r.good ? "text-foreground" : "text-muted-foreground")}>
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", r.good ? "bg-success" : "bg-warning")} />
              {r.text}
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
