"use client";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lock, PiggyBank, Percent, Wallet, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, EmptyState, ErrorState, KeyValue, Money, PageHeader, SectionCard, StatCard, StatsSkeleton, Tile } from "@/components/app/primitives";
import { money, moneyShort, plural } from "@/lib/client/format";
import { useReport } from "@/lib/client/queries";

const AXIS = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

export function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="num ml-auto pl-4 font-medium">{money(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function Reports() {
  const { data, isLoading, error, refetch } = useReport();

  return (
    <>
      <PageHeader title="Reports" description="Collections, income, receivables and profit across all loans." />
      {isLoading ? (
        <div className="space-y-4">
          <StatsSkeleton />
          <CardSkeleton rows={6} />
        </div>
      ) : error || !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <ReportBody d={data} />
      )}
    </>
  );
}

type Report = NonNullable<ReturnType<typeof useReport>["data"]>;

function ReportBody({ d }: { d: Report }) {
  const c = d.collectionRate;
  const incomeTotal = d.income.interest + d.income.fee + d.income.chargesPaid;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total receivable" value={<Money value={d.totalReceivable} />} hint="still owed by borrowers" icon={Wallet} tone="primary" />
        <StatCard label={`Collected (${c.month})`} value={<Money value={c.collected} />} hint={`${c.rate}% of ${moneyShort(c.target)} target`} icon={Percent} tone="success" />
        <StatCard label="Cash in this month" value={<Money value={c.cashIn} />} hint="payments received" icon={TrendingUp} tone="info" />
        <StatCard label="Overdue" value={<Money value={d.agingTotal} />} hint={plural(d.delinquents.length, "loan") + " past due"} icon={PiggyBank} tone={d.agingTotal > 0 ? "danger" : "neutral"} valueClassName={d.agingTotal > 0 ? "text-destructive" : undefined} />
      </div>

      <Tabs defaultValue="performance" className="mt-6">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="profit">
            <Lock className="mr-1.5 size-3.5" /> Profit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2" title="Cash received" description="Payments received in each of the last six months.">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
                    <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={moneyShort} width={56} />
                    <Tooltip cursor={{ fill: "hsl(var(--accent))" }} content={<MoneyTooltip />} />
                    <Bar dataKey="amount" name="Received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title={`Collection rate, ${c.month}`}>
              <p className="num text-4xl font-semibold tracking-tight">{c.rate}%</p>
              <Progress value={Math.min(100, c.rate)} className="mt-3" />
              <KeyValue
                className="mt-5"
                rows={[
                  { label: "Collected", value: <Money value={c.collected} /> },
                  { label: "Monthly target", value: <Money value={c.target} /> },
                  { label: "Last month", value: <Money value={c.lastMonth} /> },
                  { label: "Pace vs. last month", value: c.pace == null ? "—" : `${c.pace > 0 ? "+" : ""}${c.pace}%`, hide: !c.monthInProgress },
                  { label: "Growth vs. last month", value: `${c.growth > 0 ? "+" : ""}${c.growth}%`, hide: c.monthInProgress },
                ]}
              />
            </SectionCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Expected in the next 3 months" description="From each loan's own schedule, including what is overdue.">
              <div className="grid grid-cols-3 gap-3">
                {d.projected.map((p) => (
                  <Tile key={p.label} label={p.label} value={<Money value={p.expected} />} hint={plural(p.borrowers, "loan")} />
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Top payers" description="Total paid per loan, all time." flush>
              {d.topPayers.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <Table>
                  <TableBody>
                    {d.topPayers.slice(0, 6).map((p, i) => (
                      <TableRow key={p.name + i}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{plural(p.payCount, "payment")}</TableCell>
                        <TableCell className="num text-right font-medium">{money(p.totalPaid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="income" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Interest earned" value={<Money value={d.income.interest} />} tone="success" />
            <Tile label="Processing fees" value={<Money value={d.income.fee} />} tone="success" />
            <Tile label="Penalties + late fees" value={<Money value={d.income.chargesPaid} />} tone="success" hint={`${money(d.income.chargesOwed)} still owed`} />
            <Tile label="Total income" value={<Money value={incomeTotal} />} tone="primary" />
          </div>
          <SectionCard title="Income by month" description="Interest and charges collected from payments.">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.income.byMonth} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
                  <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={moneyShort} width={56} />
                  <Tooltip cursor={{ fill: "hsl(var(--accent))" }} content={<MoneyTooltip />} />
                  <Bar dataKey="interest" name="Interest" stackId="a" fill="hsl(var(--primary))" maxBarSize={44} />
                  <Bar dataKey="charges" name="Penalties and late fees" stackId="a" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> Interest</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" /> Penalties and late fees</span>
            </div>
          </SectionCard>
          <SectionCard title="Penalties, late fees and waivers" description="Per loan. Waivers are forgiven charges, not cash." flush>
            {d.income.loans.length === 0 ? (
              <EmptyState title="No charges yet" text="Nothing has been charged or waived so far." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-right">Penalties paid</TableHead>
                    <TableHead className="text-right">Late fees paid</TableHead>
                    <TableHead className="text-right">Still owed</TableHead>
                    <TableHead className="text-right">Waived</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.income.loans.map((l, i) => (
                    <TableRow key={l.name + l.loan + i}>
                      <TableCell>
                        <span className="font-medium">{l.name}</span>
                        <span className="block text-xs text-muted-foreground">{l.loan}</span>
                      </TableCell>
                      <TableCell className="num text-right">{money(l.penaltiesPaid)}</TableCell>
                      <TableCell className="num text-right">{money(l.lateFeesPaid)}</TableCell>
                      <TableCell className="num text-right">{l.chargesOwed > 0 ? <span className="text-destructive">{money(l.chargesOwed)}</span> : "—"}</TableCell>
                      <TableCell className="num text-right">{l.waived > 0 ? money(l.waived) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="receivables" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["1–30 days late", d.aging.days30],
                ["31–60 days late", d.aging.days60],
                ["Over 60 days late", d.aging.days90],
              ] as const
            ).map(([label, list]) => (
              <Tile key={label} label={label} value={<Money value={list.reduce((a: number, x: { overdue: number }) => a + x.overdue, 0)} />} hint={plural(list.length, "loan")} tone={list.length ? "danger" : undefined} />
            ))}
          </div>
          <SectionCard title="Overdue loans" description="Oldest first." flush>
            {d.delinquents.length === 0 ? (
              <EmptyState title="Nobody is overdue" text="Every borrower is current." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Days late</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.delinquents.map((x, i) => (
                    <TableRow key={x.email + x.loan + i}>
                      <TableCell>
                        <span className="font-medium">{x.name}</span>
                        <span className="block text-xs text-muted-foreground">{x.loan}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{x.contact || "—"}</TableCell>
                      <TableCell className="num text-right">{x.daysLate}</TableCell>
                      <TableCell className="num text-right font-medium text-destructive">{money(x.overdue)}</TableCell>
                      <TableCell className="num text-right">{money(x.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
          <SectionCard title="By bank" flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">Loans</TableHead>
                  <TableHead className="text-right">Monthly billing</TableHead>
                  <TableHead className="text-right">Overdue loans</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.bankBreakdown.map((b: { bank: string; borrowers: number; totalAmort: number; overdue: number; totalBalance: number }) => (
                  <TableRow key={b.bank}>
                    <TableCell className="font-medium">{b.bank}</TableCell>
                    <TableCell className="num text-right">{b.borrowers}</TableCell>
                    <TableCell className="num text-right">{money(b.totalAmort)}</TableCell>
                    <TableCell className="num text-right">{b.overdue || "—"}</TableCell>
                    <TableCell className="num text-right font-medium">{money(b.totalBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="profit" className="space-y-5">
          <ProfitTab d={d} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ProfitTab({ d }: { d: Report }) {
  const p = d.profit;
  if (!p.loans) {
    return (
      <SectionCard>
        <EmptyState
          icon={Lock}
          title="No bank cost entered yet"
          text="Add what the bank charges you on each loan (Loan page → ⋯ → Bank cost) and your profit shows up here. This is private and never shown to borrowers."
        />
      </SectionCard>
    );
  }
  return (
    <>
      <Badge variant="neutral" className="gap-1.5"><Lock className="size-3" /> Private. Borrowers never see this.</Badge>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Expected profit" value={<Money value={p.expected} />} tone={p.expected >= 0 ? "success" : "danger"} hint={`across ${plural(p.loans, "loan")}`} />
        <Tile label="Cash so far" value={<Money value={p.netCash} signed />} tone={p.netCash >= 0 ? "success" : "danger"} hint="collected minus paid to banks" />
        <Tile label="If all is collected" value={<Money value={p.projectedNet} signed />} tone={p.projectedNet >= 0 ? "success" : "danger"} />
        <Tile label="Owed to banks" value={<Money value={Math.max(0, p.bankTotal - p.bankPaid)} />} hint={`${money(p.bankPaid)} of ${money(p.bankTotal)} paid`} />
      </div>
      {p.missing > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {plural(p.missing, "active loan")} {p.missing === 1 ? "has" : "have"} no bank cost yet and {p.missing === 1 ? "is" : "are"} left out of these totals.
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Where the profit comes from">
          <KeyValue
            rows={[
              { label: "Interest you charge", value: <Money value={p.interestIncome} /> },
              { label: "Interest banks charge you", value: <Money value={-p.bankInterest} /> },
              { label: "Interest margin", value: <Money value={p.markup} signed /> },
              { label: "Your processing fees", value: <Money value={p.feeIncome} /> },
              { label: "Banks' one-time fees", value: <Money value={-p.bankFees} /> },
              { label: "Penalties and late fees collected", value: <Money value={p.extras} /> },
            ]}
          />
        </SectionCard>
        <SectionCard title="By loan" flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borrower</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Cash so far</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.list.map((l, i) => (
                <TableRow key={l.name + l.loan + i}>
                  <TableCell>
                    <span className="font-medium">{l.name}</span>
                    <span className="block text-xs text-muted-foreground">{l.loan}</span>
                  </TableCell>
                  <TableCell className="num text-right">{money(l.expectedProfit)}</TableCell>
                  <TableCell className="num text-right">{money(l.netCash)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </>
  );
}

