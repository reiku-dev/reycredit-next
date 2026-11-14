"use client";
import * as React from "react";
import Link from "next/link";
import { Gauge, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, CardSkeleton, EmptyState, ErrorState, Money, PageHeader, SectionCard, StatCard, StatsSkeleton } from "@/components/app/primitives";
import { plural } from "@/lib/client/format";
import { useCreditScores, useLoans } from "@/lib/client/queries";
import { cn } from "@/lib/client/utils";
import { gradeTone } from "./score-card";

const GRADE_BAR: Record<string, string> = { A: "bg-success", B: "bg-success/70", C: "bg-warning", D: "bg-warning/70", E: "bg-destructive" };

export function CreditScores() {
  const { data, isLoading, error, refetch } = useCreditScores();
  const { data: loans } = useLoans();
  const [query, setQuery] = React.useState("");
  const firstLoan = React.useMemo(() => new Map((loans ?? []).map((l) => [l.email, l.rowIndex])), [loans]);
  const shown = (data?.borrowers ?? []).filter((b) => !query.trim() || (b.name + b.email).toLowerCase().includes(query.trim().toLowerCase()));
  const maxBucket = Math.max(1, ...Object.values(data?.buckets ?? { A: 0 }));

  return (
    <>
      <PageHeader title="Credit scores" description="A 0–100 score for each borrower, from how on time and how fully they pay each billed cycle." />
      {isLoading ? (
        <div className="space-y-4">
          <StatsSkeleton count={3} />
          <CardSkeleton rows={6} />
        </div>
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <StatCard label="Average score" value={data.scoredCount ? data.average : "—"} hint={`${plural(data.scoredCount, "borrower")} with enough history`} icon={Gauge} tone="primary" />
            <Card className="p-4 sm:p-5 lg:col-span-2">
              <p className="text-[12.5px] font-medium text-muted-foreground">Grade distribution</p>
              <div className="mt-3 grid grid-cols-5 gap-3">
                {(["A", "B", "C", "D", "E"] as const).map((g) => (
                  <div key={g} className="flex flex-col items-center gap-1.5">
                    <span className="num text-sm font-semibold">{data.buckets[g] ?? 0}</span>
                    <div className="flex h-16 w-full items-end rounded bg-muted">
                      <div className={cn("w-full rounded", GRADE_BAR[g])} style={{ height: `${Math.max(6, ((data.buckets[g] ?? 0) / maxBucket) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{g}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <SectionCard
            className="mt-5"
            flush
            title="Borrowers"
            actions={
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search borrowers" className="h-8 pl-9" aria-label="Search borrowers" />
              </div>
            }
          >
            {shown.length === 0 ? (
              <EmptyState icon={Gauge} title="No borrowers found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Standing</TableHead>
                    <TableHead className="text-right">Avg. days late</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((b) => {
                    const row = firstLoan.get(b.email);
                    return (
                      <TableRow key={b.email}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={b.name} />
                            <div className="min-w-0">
                              {row ? (
                                <Link href={`/admin/loans/${row}`} className="block truncate font-medium hover:underline">
                                  {b.name}
                                </Link>
                              ) : (
                                <span className="block truncate font-medium">{b.name}</span>
                              )}
                              <span className="block truncate text-xs text-muted-foreground">{plural(b.loans, "loan")}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("inline-grid size-8 place-items-center rounded-lg bg-muted text-sm font-bold", gradeTone(b.tone))}>{b.grade}</span>
                        </TableCell>
                        <TableCell className="num text-right font-medium">{b.scored ? b.score : "—"}</TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{b.label}</span>
                          {b.trend === "improving" ? <Badge variant="success" className="ml-2">Improving</Badge> : b.trend === "slipping" ? <Badge variant="danger" className="ml-2">Slipping</Badge> : null}
                        </TableCell>
                        <TableCell className="num text-right">{b.scored ? b.avgDaysLate : "—"}</TableCell>
                        <TableCell className="text-right">{b.arrears > 0 ? <Money value={b.arrears} className="text-destructive" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </>
      )}
    </>
  );
}
