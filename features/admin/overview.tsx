"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CircleDollarSign, FileText, PlusCircle, Search, Users, Wallet } from "lucide-react";
import { Avatar, EmptyState, ErrorState, Money, PageHeader, StatCard, StatsSkeleton, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isClosed, isLate, numOf, plural, statusMeta } from "@/lib/client/format";
import { useLoans } from "@/lib/client/queries";

type Filter = "all" | "active" | "late" | "closed";

export function Overview() {
  const { data, isLoading, error, refetch } = useLoans();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [bank, setBank] = React.useState("all");

  const rows = data ?? [];
  const banks = React.useMemo(() => Array.from(new Set(rows.map((r) => r.bank).filter(Boolean))).sort(), [rows]);

  const stats = React.useMemo(() => {
    let receivable = 0, monthly = 0, active = 0, late = 0, closed = 0;
    for (const r of rows) {
      if (isClosed(r.status)) { closed++; continue; }
      active++;
      receivable += numOf(r.balance);
      monthly += numOf(r.monthlyAmort);
      if (isLate(r.status)) late++;
    }
    return { receivable, monthly, active, late, closed };
  }, [rows]);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "active" && isClosed(r.status)) return false;
      if (filter === "closed" && !isClosed(r.status)) return false;
      if (filter === "late" && !isLate(r.status)) return false;
      if (bank !== "all" && r.bank !== bank) return false;
      if (!q) return true;
      return [r.name, r.email, r.loan, r.bank].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, query, filter, bank]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Every loan, what is still owed, and who needs attention."
        actions={
          <Button asChild>
            <Link href="/admin/borrowers/new">
              <PlusCircle /> New borrower
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Outstanding balance" value={<Money value={stats.receivable} />} hint={`across ${plural(stats.active, "active loan")}`} icon={Wallet} tone="primary" />
          <StatCard label="Monthly billing" value={<Money value={stats.monthly} />} hint="regular amortizations due each month" icon={CircleDollarSign} tone="info" />
          <StatCard label="Needs attention" value={stats.late} hint={stats.late ? "overdue or short on payment" : "everyone is current"} icon={AlertTriangle} tone={stats.late ? "danger" : "success"} valueClassName={stats.late ? "text-destructive" : undefined} />
          <StatCard label="Borrowers" value={new Set(rows.map((r) => r.email)).size} hint={`${plural(stats.closed, "loan")} fully paid`} icon={Users} tone="neutral" />
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, loan or bank" className="pl-9" aria-label="Search loans" />
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All loans</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="late">Needs attention</SelectItem>
                <SelectItem value="closed">Fully paid</SelectItem>
              </SelectContent>
            </Select>
            {banks.length > 0 ? (
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Filter by bank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All banks</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={rows.length ? "No loans match your filters" : "No loans yet"}
            text={rows.length ? "Try a different search or clear the filters." : "Add your first borrower to get started."}
            action={
              rows.length ? undefined : (
                <Button asChild size="sm">
                  <Link href="/admin/borrowers/new">
                    <PlusCircle /> New borrower
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.rowIndex} className="group cursor-pointer">
                      <TableCell>
                        <Link href={`/admin/loans/${r.rowIndex}`} className="flex items-center gap-3 outline-none">
                          <Avatar name={r.name} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{r.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">{r.loan}</TableCell>
                      <TableCell className="text-muted-foreground">{r.bank || "—"}</TableCell>
                      <TableCell className="num text-right font-medium">{r.balance}</TableCell>
                      <TableCell className="num text-right text-muted-foreground">{r.monthlyAmort}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{isClosed(r.status) ? "—" : r.nextDue || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/loans/${r.rowIndex}`} aria-label={`Open ${r.name}'s loan`} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {shown.map((r) => (
                <li key={r.rowIndex}>
                  <Link href={`/admin/loans/${r.rowIndex}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-accent">
                    <Avatar name={r.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.loan}</span>
                      <span className="mt-1.5 block">
                        <StatusBadge status={r.status} />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-sm font-semibold">{r.balance}</span>
                      <span className="block text-xs text-muted-foreground">{isClosed(r.status) ? statusMeta(r.status).label : r.nextDue ? `Due ${r.nextDue}` : ""}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              Showing {shown.length} of {rows.length} {rows.length === 1 ? "loan" : "loans"}
            </p>
          </>
        )}
      </Card>
    </>
  );
}
