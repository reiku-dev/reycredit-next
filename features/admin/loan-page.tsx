"use client";
import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Banknote, Bell, CalendarClock, FileText, Lock, Mail, MailPlus, MoreHorizontal, Pencil, Receipt, Send, Trash2,
} from "lucide-react";
import type { LoanDetail } from "@/lib/functions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, CardSkeleton, EmptyState, ErrorState, KeyValue, Money, SectionCard, StatCard, StatsSkeleton, StatusBadge, Tile } from "@/components/app/primitives";
import { isClosed, money, plural, progressOf } from "@/lib/client/format";
import { useBillingSchedule, useLoanDetail, useRefreshLoans } from "@/lib/client/queries";
import { rpc } from "@/lib/client/rpc";
import { BankCostDialog, DeleteLoanDialog, DocumentDialog, EditLoanSheet, PaymentDialog } from "./loan-dialogs";
import { ScoreCard } from "./score-card";

type EmailAction = "sendMonthlyStatement" | "sendDueDateReminder" | "sendNewLoanNotification" | "sendWelcomeEmail";

export function LoanPage({ row }: { row: number }) {
  const { data: loan, isLoading, error, refetch } = useLoanDetail(row);
  const [dialog, setDialog] = React.useState<null | "pay" | "edit" | "cost" | "delete">(null);
  const [doc, setDoc] = React.useState<"soa" | "agreement" | null>(null);
  const refresh = useRefreshLoans();

  const email = useMutation({
    mutationFn: async (fn: EmailAction) => {
      const msg = await rpc(fn, row);
      if (typeof msg === "string" && msg.includes("❌")) throw new Error(msg.replace(/^\S+\s*/, ""));
      return typeof msg === "string" ? msg.replace(/^\S+\s*/, "") : "Sent.";
    },
    onSuccess: (m) => {
      toast.success("Email sent", { description: m });
      void refresh(row);
    },
    onError: (e: Error) => toast.error("Email not sent", { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <StatsSkeleton />
        <CardSkeleton rows={5} />
      </div>
    );
  }
  if (error || !loan) return <ErrorState title="Couldn't load this loan" error={error} onRetry={() => void refetch()} />;

  const closed = isClosed(loan.status);
  const next = loan.nextBillDetails;
  const pct = progressOf(loan.amountPaid, loan.balance);

  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All loans
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={loan.borrowerName} className="size-12 text-sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{loan.borrowerName}</h1>
              <StatusBadge status={loan.status} />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {loan.loanName} · {loan.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!closed ? (
            <Button onClick={() => setDialog("pay")}>
              <Banknote /> Record payment
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Loan</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDialog("edit")}>
                <Pencil /> Edit loan
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("cost")}>
                <Lock /> Bank cost (private)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Documents</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDoc("soa")}>
                <FileText /> Statement of account
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDoc("agreement")}>
                <FileText /> Loan agreement
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Email the borrower</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => email.mutate("sendMonthlyStatement")}>
                <Send /> Monthly statement
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => email.mutate("sendDueDateReminder")}>
                <Bell /> Due date reminder
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => email.mutate("sendNewLoanNotification")}>
                <MailPlus /> Loan notice and agreement
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => email.mutate("sendWelcomeEmail")}>
                <Mail /> Welcome email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("delete")}>
                <Trash2 /> Delete loan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loan.termsMismatch ? (
        <Alert variant="warning" className="mb-5">
          The saved monthly amount doesn't add up to the total payable. Expected total <b>{money(loan.expectedPayable)}</b> (about {money(loan.impliedAmort)} a month). Edit the loan to correct it.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Balance owed" value={<Money value={loan.balance} />} hint={closed ? "Fully paid" : `${plural(loan.remaining, "payment")} remaining`} icon={Banknote} tone={closed ? "success" : "primary"} />
        <StatCard label="Paid so far" value={<Money value={loan.amountPaid} />} hint={`of ${money(loan.totalPayable)} total payable`} icon={Receipt} tone="success" />
        <StatCard
          label="Next payment"
          value={next ? <Money value={next.bill} /> : "—"}
          hint={next ? `due ${next.dueDate}` : closed ? "Nothing due" : undefined}
          icon={CalendarClock}
          tone="info"
        />
        <StatCard
          label="Overdue"
          value={<Money value={loan.arrears} />}
          hint={loan.arrears > 0 ? "past due and unpaid" : "nothing overdue"}
          icon={AlertTriangle}
          tone={loan.arrears > 0 ? "danger" : "neutral"}
          valueClassName={loan.arrears > 0 ? "text-destructive" : undefined}
        />
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <span className="font-medium">Repayment progress</span>
          <span className="num font-semibold">{pct}%</span>
        </div>
        <Progress value={pct} indicatorClassName={closed ? "bg-success" : undefined} aria-label="Repayment progress" />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="payments">
            Payments
            <span className="ml-1.5 rounded-full bg-background px-1.5 text-[11px] font-semibold">{loan.history.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab loan={loan} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab row={row} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab loan={loan} />
        </TabsContent>
      </Tabs>

      <PaymentDialog loan={loan} open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : null)} />
      <EditLoanSheet loan={loan} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      <BankCostDialog loan={loan} open={dialog === "cost"} onOpenChange={(o) => setDialog(o ? "cost" : null)} />
      <DeleteLoanDialog loan={loan} open={dialog === "delete"} onOpenChange={(o) => setDialog(o ? "delete" : null)} />
      <DocumentDialog row={row} type={doc} onClose={() => setDoc(null)} />
    </>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab({ loan }: { loan: LoanDetail }) {
  const m = loan.money;
  const next = loan.nextBillDetails;
  const p = loan.profit;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard title="Loan terms">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Amount borrowed" value={<Money value={loan.originalAmount} />} />
            <Tile label="Interest" value={loan.monthlyRate} hint={`per month (${loan.effectiveRate} a year)`} />
            <Tile label="Term" value={plural(loan.terms, "month")} hint={`started ${loan.startDate}`} />
            <Tile label="Total interest" value={<Money value={loan.totalInterest} />} />
            <Tile label="Processing fee" value={<Money value={loan.processingFee} />} hint="billed once" />
            <Tile label="Total payable" value={<Money value={loan.totalPayable} />} tone="primary" />
          </div>
          <div className="mt-5 grid gap-x-10 sm:grid-cols-2">
            <KeyValue
              rows={[
                { label: "Loan type", value: loan.loanType },
                { label: "Monthly amortization", value: <Money value={loan.monthlyAmort} /> },
                { label: "Bank / partner", value: loan.partner || "None" },
              ]}
            />
            <KeyValue
              rows={[
                { label: "Due day", value: `Day ${loan.dueDay} of the month` },
                { label: "Late penalty", value: `${loan.penaltyRate}% per month${loan.penaltyRateOwn === null ? " (company default)" : ""}` },
                { label: "Late payment fee", value: loan.lateFee ? <Money value={loan.lateFee} /> : "None" },
                { label: "Late fee starts", value: loan.lateFeeFromISO || "Every cycle", hide: !loan.lateFee },
              ]}
            />
          </div>
        </SectionCard>

        <SectionCard title="Where the money went" description="Payments clear penalties and late fees first, then the monthly instalments.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Principal paid" value={<Money value={m.principalPaid} />} />
            <Tile label="Interest paid" value={<Money value={m.interestPaid} />} />
            <Tile label="Fee paid" value={<Money value={m.feePaid} />} />
            <Tile label="Charges paid" value={<Money value={m.chargesPaid} />} />
          </div>
          <div className="mt-5 grid gap-x-10 sm:grid-cols-2">
            <KeyValue
              rows={[
                { label: "Penalties charged", value: <Money value={m.penaltiesCharged} /> },
                { label: "Late fees charged", value: <Money value={m.lateFeesCharged} /> },
                { label: "Charges still owed", value: <Money value={m.chargesOwed} className={m.chargesOwed > 0 ? "text-destructive" : ""} /> },
              ]}
            />
            <KeyValue
              rows={[
                { label: "Instalments paid", value: <Money value={m.instalmentsPaid} /> },
                { label: "Instalments left", value: <Money value={m.instalmentsLeft} /> },
                { label: "Forgiven (waivers)", value: <Money value={m.waivedTotal} />, hide: !(m.waivedTotal > 0) },
                { label: "Paid ahead", value: <Money value={m.overpaid} />, hide: !(m.overpaid > 0) },
              ]}
            />
          </div>
        </SectionCard>

        {p && p.hasBankCost ? (
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                Your profit <Badge variant="neutral" dot={false}><Lock className="mr-1 size-3" />Private</Badge>
              </span>
            }
            description="Never shown to the borrower or included in any email."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Expected profit" value={<Money value={p.expectedProfit} />} tone={p.expectedProfit >= 0 ? "success" : "danger"} hint={`${p.marginPct}% margin`} />
              <Tile label="Bank charges you" value={<Money value={p.bankTotal} />} hint={`${money(p.bankPaid)} paid so far`} />
              <Tile label="Cash so far" value={<Money value={p.netCash} signed />} tone={p.netCash >= 0 ? "success" : "danger"} hint="collected minus paid to bank" />
              <Tile label="If all is collected" value={<Money value={p.projectedNet} signed />} tone={p.projectedNet >= 0 ? "success" : "danger"} />
            </div>
            <div className="mt-5 grid gap-x-10 sm:grid-cols-2">
              <KeyValue
                rows={[
                  { label: "Interest you charge", value: <Money value={p.interestIncome} /> },
                  { label: "Interest the bank charges you", value: <Money value={p.bankInterest} /> },
                  { label: "Your interest margin", value: <Money value={p.interestMarkup} signed /> },
                ]}
              />
              <KeyValue
                rows={[
                  { label: "Your processing fee", value: <Money value={p.feeIncome} /> },
                  { label: "Bank's one-time fee", value: <Money value={p.bankFeeCharged} /> },
                  { label: "Penalties and late fees collected", value: <Money value={p.extrasCollected} /> },
                ]}
              />
            </div>
          </SectionCard>
        ) : null}
      </div>

      <div className="space-y-5">
        {next ? (
          <SectionCard title="Next bill" description={`Due ${next.dueDate}${next.isOverdue ? " (past due)" : ""}`}>
            <KeyValue
              rows={[
                { label: "Monthly amortization", value: <Money value={next.baseAmort} />, hide: !(next.baseAmort > 0) },
                { label: "Processing fee", value: <Money value={next.feeAmount} />, hide: !next.hasFee },
                { label: next.isPastTerm ? "Unpaid balance past the term" : "Overdue from before", value: <Money value={next.overdueAmount} className="text-destructive" />, hide: !(next.overdueAmount > 0) },
                { label: "Paid toward this bill", value: <Money value={next.paidSoFar} />, hide: !(next.paidSoFar > 0) },
                { label: <span className="font-semibold text-foreground">Total due</span>, value: <Money value={next.totalDue} className="text-base font-semibold" /> },
              ]}
            />
            {next.overdueSeparate > 0 ? <p className="mt-3 text-xs text-muted-foreground">An overdue amount of {money(next.overdueSeparate)} is billed separately until {next.mergesOn}.</p> : null}
          </SectionCard>
        ) : null}

        <SectionCard title="Borrower">
          <KeyValue
            rows={[
              { label: "Name", value: loan.borrowerName },
              { label: "Email", value: <span className="break-all">{loan.email}</span> },
              { label: "CC email", value: <span className="break-all">{loan.ccEmail}</span>, hide: !loan.ccEmail },
              { label: "Contact", value: loan.contactNumber || "—" },
              { label: "Address", value: loan.address || "—" },
              { label: "Valid ID", value: loan.validId || "—" },
            ]}
          />
        </SectionCard>

        <ScoreCard email={loan.email} />
      </div>
    </div>
  );
}

/* ---------------- Schedule ---------------- */

function ScheduleTab({ row }: { row: number }) {
  const { data, isLoading, error, refetch } = useBillingSchedule(row);
  if (isLoading) return <CardSkeleton rows={6} />;
  if (error || !data) return <SectionCard><ErrorState error={error} onRetry={() => void refetch()} /></SectionCard>;
  return (
    <SectionCard title="Billing schedule" description="Every cycle, what was billed, what was paid and what is still open." flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead className="text-right">Billed</TableHead>
            <TableHead className="text-right">Penalty + fee</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.schedule.map((r) => (
            <TableRow key={r.month + r.dueDate}>
              <TableCell className="whitespace-nowrap font-medium">
                {r.month}
                {r.isExtension ? <span className="ml-1.5 text-[11px] text-destructive">extra</span> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{r.dueDate}</TableCell>
              <TableCell className="num text-right">{money(r.bill)}</TableCell>
              <TableCell className="num text-right text-muted-foreground">{r.penalty + r.lateFee > 0 ? money(r.penalty + r.lateFee) : "—"}</TableCell>
              <TableCell className="num text-right">{r.paid > 0 ? money(r.paid) : "—"}</TableCell>
              <TableCell className="num text-right font-medium">{r.outstanding > 0 ? money(r.outstanding) : "—"}</TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

/* ---------------- Payments ---------------- */

function PaymentsTab({ loan }: { loan: LoanDetail }) {
  const send = useMutation({
    mutationFn: async (h: LoanDetail["history"][number]) => {
      const res = await rpc("sendPaymentReceipt", loan.rowIndex, h.month, h.amount, h.date, h.receiptNo, h.waiver ? "Fee/Interest Waiver" : "");
      if (!res.success) throw new Error(res.msg || "Couldn't send.");
      return res.msg;
    },
    onSuccess: (m) => toast.success("Receipt sent", { description: m }),
    onError: (e: Error) => toast.error("Receipt not sent", { description: e.message }),
  });
  const rows = [...loan.history].reverse();
  if (!rows.length) {
    return (
      <SectionCard>
        <EmptyState icon={Receipt} title="No payments yet" text="Payments and waivers you record appear here." />
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Payment history" flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>For month</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Applied to</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((h, i) => (
            <TableRow key={h.receiptNo + i}>
              <TableCell className="whitespace-nowrap">{h.date || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{h.month}</TableCell>
              <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                {h.waiver ? <Badge variant="warning">Waiver</Badge> : h.receiptNo}
              </TableCell>
              <TableCell className="num text-right font-medium">{h.waiver ? <span className="text-warning">−{money(h.amount)}</span> : money(h.amount)}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {h.waiver ? (
                  <>
                    {money(h.waivedApplied)} forgiven{h.waivedUnused > 0 ? `, ${money(h.waivedUnused)} unused` : ""}
                  </>
                ) : (
                  <>
                    {h.toCharges > 0 ? `${money(h.toCharges)} charges, ` : ""}
                    {money(h.toInstalments)} loan
                  </>
                )}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon-sm" aria-label="Email receipt again" title="Email receipt again" onClick={() => send.mutate(h)} disabled={send.isPending}>
                  <Mail />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
