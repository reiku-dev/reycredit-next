"use client";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarClock, Clock, KeyRound, LogOut, Mail, MapPin, Phone, Receipt, Wallet } from "lucide-react";
import type { LoanDetail } from "@/lib/functions";
import { Brand } from "@/components/app/brand";
import { InstallPrompt } from "@/components/app/install-prompt";
import { Avatar, CardSkeleton, CopyButton, EmptyState, ErrorState, Field, KeyValue, Money, SectionCard, StatusBadge, ThemeToggle, Tile } from "@/components/app/primitives";
import { useSession, useSignOut } from "@/components/app/session";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isClosed, money, plural, progressOf } from "@/lib/client/format";
import { usePortalInfo } from "@/lib/client/queries";
import { rpc, rpcRead } from "@/lib/client/rpc";

export function Portal() {
  const session = useSession();
  const signOut = useSignOut();
  const { data: info } = usePortalInfo();
  const loans = useQuery({ queryKey: ["portalLoans", session.email], queryFn: async () => (await rpc("getBorrowerData", session.email)) as LoanDetail[] });
  const profile = useQuery({ queryKey: ["profile", session.email], queryFn: () => rpcRead("getBorrowerPersonalDetails", session.email) });
  const [pw, setPw] = React.useState(false);

  const name = profile.data?.name || session.email.split("@")[0];
  const totalBalance = (loans.data ?? []).reduce((a, l) => a + (l.balance > 0 ? l.balance : 0), 0);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4">
          <Brand />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setPw(true)}>
              <KeyRound /> <span className="hidden sm:inline">Password</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="page-enter mx-auto max-w-4xl space-y-5 px-4 py-6 sm:py-8">
        <div className="flex items-center gap-4">
          <Avatar name={name} className="size-12 text-sm" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
          </div>
          {loans.data && loans.data.length > 1 ? (
            <div className="ml-auto hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">Total balance</p>
              <Money value={totalBalance} className="text-lg font-semibold" />
            </div>
          ) : null}
        </div>

        <InstallPrompt />

        {loans.isLoading ? (
          <CardSkeleton rows={5} />
        ) : loans.error ? (
          <SectionCard><ErrorState error={loans.error} onRetry={() => void loans.refetch()} /></SectionCard>
        ) : !loans.data?.length ? (
          <SectionCard><EmptyState icon={Wallet} title="No loans found" text="Once a loan is set up for you, it appears here." /></SectionCard>
        ) : (
          loans.data.map((l) => <LoanCard key={l.rowIndex} loan={l} email={session.email} />)
        )}

        <HowToPay />
        <Support />
        <p className="pb-4 text-center text-xs text-muted-foreground">© 2026 {info?.lenderName && info.lenderName !== "Your Name" ? info.lenderName : "Rey Flores Pedrabuena"}. All rights reserved.</p>
      </main>

      <PasswordDialog open={pw} onOpenChange={setPw} email={session.email} />
    </div>
  );
}

function LoanCard({ loan, email }: { loan: LoanDetail; email: string }) {
  const closed = isClosed(loan.status);
  const next = loan.nextBillDetails;
  const pct = progressOf(loan.amountPaid, loan.balance);
  return (
    <SectionCard
      title={loan.loanName}
      description={`${loan.loanType} · started ${loan.startDate}${loan.partner ? ` · ${loan.partner}` : ""}`}
      actions={<StatusBadge status={loan.status} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Balance" value={<Money value={loan.balance} />} tone={closed ? "success" : "primary"} hint={closed ? "Fully paid" : `${plural(loan.remaining, "payment")} left`} />
        <Tile label="Next payment" value={next ? <Money value={next.bill} /> : "—"} hint={next ? `due ${next.dueDate}` : undefined} />
        <Tile label="Overdue" value={<Money value={loan.arrears} />} tone={loan.arrears > 0 ? "danger" : undefined} hint={loan.arrears > 0 ? "please pay as soon as you can" : "nothing overdue"} />
        <Tile label="Paid so far" value={<Money value={loan.amountPaid} />} tone="success" />
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-[13px]">
          <span className="text-muted-foreground">Repayment progress</span>
          <span className="num font-semibold">{pct}%</span>
        </div>
        <Progress value={pct} indicatorClassName={closed ? "bg-success" : undefined} aria-label="Repayment progress" />
      </div>

      {next && !closed ? (
        <div className="mt-5 rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" /> Your next bill is due {next.dueDate}
          </div>
          <KeyValue
            rows={[
              { label: "Monthly amortization", value: <Money value={next.baseAmort} />, hide: !(next.baseAmort > 0) },
              { label: "Processing fee", value: <Money value={next.feeAmount} />, hide: !next.hasFee },
              { label: next.isPastTerm ? "Unpaid balance past the term" : "Overdue from before", value: <Money value={next.overdueAmount} className="text-destructive" />, hide: !(next.overdueAmount > 0) },
              { label: "Already paid toward this bill", value: <Money value={next.paidSoFar} />, hide: !(next.paidSoFar > 0) },
              { label: <span className="font-semibold text-foreground">Total to pay</span>, value: <Money value={next.totalDue} className="text-base font-semibold" /> },
            ]}
          />
          {loan.money.chargesOwed > 0 ? <p className="mt-3 text-xs text-muted-foreground">This includes {money(loan.money.chargesOwed)} in late penalties and fees.</p> : null}
          {next.overdueSeparate > 0 ? <p className="mt-2 text-xs text-muted-foreground">You also have {money(next.overdueSeparate)} overdue from before, billed on its own until {next.mergesOn}.</p> : null}
        </div>
      ) : null}

      <Tabs defaultValue="history" className="mt-5">
        <TabsList>
          <TabsTrigger value="history">Payments ({loan.history.length})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="terms">Loan details</TabsTrigger>
        </TabsList>
        <TabsContent value="history"><History loan={loan} /></TabsContent>
        <TabsContent value="schedule"><Schedule email={email} loanName={loan.loanName} /></TabsContent>
        <TabsContent value="terms">
          <div className="grid gap-x-10 sm:grid-cols-2">
            <KeyValue rows={[
              { label: "Amount borrowed", value: <Money value={loan.originalAmount} /> },
              { label: "Interest", value: `${loan.monthlyRate} per month` },
              { label: "Term", value: plural(loan.terms, "month") },
            ]} />
            <KeyValue rows={[
              { label: "Total payable", value: <Money value={loan.totalPayable} /> },
              { label: "Monthly amortization", value: <Money value={loan.monthlyAmort} /> },
              { label: "Due every", value: `Day ${loan.dueDay}` },
              { label: "Late payment fee", value: <Money value={loan.lateFee} />, hide: !loan.lateFee },
            ]} />
          </div>
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}

function History({ loan }: { loan: LoanDetail }) {
  const rows = [...loan.history].reverse();
  if (!rows.length) return <EmptyState icon={Receipt} title="No payments yet" text="Your payments will be listed here after we record them." />;
  return (
    <div className="-mx-5 border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>For</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((h, i) => (
            <TableRow key={h.receiptNo + i}>
              <TableCell className="whitespace-nowrap">{h.date || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{h.month}</TableCell>
              <TableCell className="max-w-[10rem] truncate text-muted-foreground">{h.waiver ? <Badge variant="warning">Fee waived</Badge> : h.receiptNo}</TableCell>
              <TableCell className="num text-right font-medium">{h.waiver ? <span className="text-warning">−{money(h.amount)}</span> : money(h.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Schedule({ email, loanName }: { email: string; loanName: string }) {
  const q = useQuery({ queryKey: ["portalSchedule", email, loanName], queryFn: () => rpcRead("getBillingScheduleByEmail", email, loanName) });
  if (q.isLoading) return <CardSkeleton rows={4} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div className="-mx-5 border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Bill</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.schedule.map((r) => (
            <TableRow key={r.month + r.dueDate}>
              <TableCell className="whitespace-nowrap font-medium">{r.month}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{r.dueDate}</TableCell>
              <TableCell className="num text-right">{money(r.bill)}</TableCell>
              <TableCell className="num text-right">{r.paid > 0 ? money(r.paid) : "—"}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HowToPay() {
  const { data } = usePortalInfo();
  const methods = [
    { name: "GCash", value: data?.gcash },
    { name: "BPI", value: data?.bpi },
    { name: "MariBank", value: data?.maribank },
  ].filter((m) => m.value && !/X{4,}/i.test(m.value));
  if (!methods.length) return null;
  return (
    <SectionCard title="How to pay" description="Send your payment, then keep the reference number. We record it and email you a receipt.">
      <ul className="divide-y rounded-lg border">
        {methods.map((m) => (
          <li key={m.name} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{m.name.slice(0, 2)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">{m.name}</span>
              <span className="num block truncate font-medium">{m.value}</span>
            </span>
            <CopyButton text={m.value as string} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Support() {
  const { data } = usePortalInfo();
  if (!data) return null;
  const rows = [
    { icon: Mail, label: data.supportEmail && !/example\.com/.test(data.supportEmail) ? data.supportEmail : "", href: `mailto:${data.supportEmail}` },
    { icon: Phone, label: data.supportPhone && !/X{4,}/i.test(data.supportPhone) ? data.supportPhone : "", href: `tel:${data.supportPhone}` },
    { icon: Clock, label: data.hours, href: "" },
    { icon: MapPin, label: data.address && !/^Your /.test(data.address) ? data.address : "", href: "" },
  ].filter((r) => r.label);
  if (!rows.length) return null;
  return (
    <SectionCard title="Need help?" description="Questions about a bill or a payment? Reach us here.">
      <ul className="space-y-2.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            <r.icon className="size-4 text-muted-foreground" />
            {r.href ? <a href={r.href} className="font-medium hover:underline">{r.label}</a> : <span>{r.label}</span>}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

const pwSchema = z
  .object({ password: z.string().min(4, "Use at least 4 characters."), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

function PasswordDialog({ open, onOpenChange, email }: { open: boolean; onOpenChange: (o: boolean) => void; email: string }) {
  const form = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema), defaultValues: { password: "", confirm: "" } });
  React.useEffect(() => { if (!open) form.reset(); }, [open, form]);
  const save = useMutation({
    mutationFn: async (v: z.infer<typeof pwSchema>) => {
      const r = await rpc("changeUserPassword", email, v.password);
      if (r !== "Success") throw new Error(String(r).replace(/^Error:\s*/, ""));
    },
    onSuccess: () => { toast.success("Password changed", { description: "Use it the next time you sign in." }); onOpenChange(false); },
    onError: (e: Error) => toast.error("Couldn't change password", { description: e.message }),
  });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>Choose something only you would know.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="New password" htmlFor="pw1" error={e.password?.message}><Input id="pw1" type="password" autoComplete="new-password" {...form.register("password")} aria-invalid={!!e.password} /></Field>
            <Field label="Confirm new password" htmlFor="pw2" error={e.confirm?.message}><Input id="pw2" type="password" autoComplete="new-password" {...form.register("confirm")} aria-invalid={!!e.confirm} /></Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Change password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
