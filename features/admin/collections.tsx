"use client";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, CalendarDays, ChevronDown, Hash, Trophy } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, EmptyState, ErrorState, Money, PageHeader, SectionCard, StatCard, StatsSkeleton } from "@/components/app/primitives";
import { money, moneyShort, plural } from "@/lib/client/format";
import { useCollections } from "@/lib/client/queries";
import { cn } from "@/lib/client/utils";
import { MoneyTooltip } from "./reports";

type Data = NonNullable<ReturnType<typeof useCollections>["data"]>;
type Payment = { name: string; loan: string; forMonth: string; amount: number; date: string; receiptNo: string; method: string };
type Bucket = { key: string; label: string; total: number; count: number; payments: Payment[] };

export function Collections() {
  const { data, isLoading, error, refetch } = useCollections();
  return (
    <>
      <PageHeader title="Collections" description="Every peso actually received, by the month it arrived or the month it paid for. Waivers are not included." />
      {isLoading ? (
        <div className="space-y-4">
          <StatsSkeleton />
          <CardSkeleton rows={6} />
        </div>
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.count === 0 ? (
        <SectionCard>
          <EmptyState icon={Banknote} title="No payments recorded yet" text="Collections appear here as you record payments." />
        </SectionCard>
      ) : (
        <Body d={data} />
      )}
    </>
  );
}

function Body({ d }: { d: Data }) {
  const chart = React.useMemo(() => d.received.filter((m) => m.key !== "undated").slice(0, 12).reverse().map((m) => ({ label: m.label.replace(/ 20(\d\d)$/, " ’$1"), total: m.total })), [d.received]);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lifetime collected" value={<Money value={d.lifetime} />} hint={`${plural(d.count, "payment")}${d.firstPayment ? ` since ${d.firstPayment}` : ""}`} icon={Banknote} tone="success" />
        <StatCard label="Monthly average" value={<Money value={d.monthlyAverage} />} hint={`over ${plural(d.activeMonths, "month")}`} icon={CalendarDays} tone="info" />
        <StatCard label="Best month" value={d.bestMonth ? <Money value={d.bestMonth.total} /> : "—"} hint={d.bestMonth?.label} icon={Trophy} tone="warning" />
        <StatCard label="Payments" value={d.count} hint={d.waivedCount ? `plus ${plural(d.waivedCount, "waiver")} (${money(d.waivedTotal)})` : undefined} icon={Hash} tone="neutral" />
      </div>

      {d.undated > 0 || d.unlabelled > 0 ? (
        <Alert variant="warning" className="mt-4">
          {d.undated > 0 ? `${plural(d.undated, "payment")} has no date recorded. ` : ""}
          {d.unlabelled > 0 ? `${plural(d.unlabelled, "payment")} has no billing month recorded.` : ""}
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Received per month" description="Last 12 months with payments.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={moneyShort} width={56} />
                <Tooltip cursor={{ fill: "hsl(var(--accent))" }} content={<MoneyTooltip />} />
                <Bar dataKey="total" name="Received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="By method" flush>
          <Table>
            <TableBody>
              {d.methods.map((m) => (
                <TableRow key={m.method}>
                  <TableCell className="font-medium">{m.method}</TableCell>
                  <TableCell className="text-muted-foreground">{plural(m.count, "payment")}</TableCell>
                  <TableCell className="num text-right font-medium">{money(m.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {d.years.length > 1 ? (
            <div className="mt-2 border-t px-5 py-3 text-[13px]">
              {d.years.map((y) => (
                <p key={y.year} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">{y.year}</span>
                  <span className="num font-medium">{money(y.total)}</span>
                </p>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </div>

      <Tabs defaultValue="received" className="mt-6">
        <TabsList>
          <TabsTrigger value="received">By date received</TabsTrigger>
          <TabsTrigger value="billing">By billing month</TabsTrigger>
        </TabsList>
        <TabsContent value="received">
          <Months list={d.received as Bucket[]} />
        </TabsContent>
        <TabsContent value="billing">
          <Months list={d.billing as Bucket[]} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Months({ list }: { list: Bucket[] }) {
  const [open, setOpen] = React.useState<string | null>(list[0]?.key ?? null);
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {list.map((m) => {
        const isOpen = open === m.key;
        return (
          <div key={m.key} className="border-b last:border-0">
            <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-accent/50" onClick={() => setOpen(isOpen ? null : m.key)} aria-expanded={isOpen}>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              <span className="flex-1 text-sm font-medium">{m.label}</span>
              <span className="text-xs text-muted-foreground">{plural(m.count, "payment")}</span>
              <span className="num w-28 text-right text-sm font-semibold">{money(m.total)}</span>
            </button>
            {isOpen ? (
              <div className="border-t bg-muted/20">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.payments.map((p, i) => (
                      <TableRow key={p.receiptNo + i}>
                        <TableCell className="whitespace-nowrap">{p.date || "—"}</TableCell>
                        <TableCell>
                          <span className="font-medium">{p.name}</span>
                          <span className="block text-xs text-muted-foreground">{p.loan}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{p.forMonth}</TableCell>
                        <TableCell className="text-muted-foreground">{p.method}</TableCell>
                        <TableCell className="num text-right font-medium">{money(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
