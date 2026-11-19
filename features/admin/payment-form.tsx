"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Ban, Banknote } from "lucide-react";
import type { LoanDetail } from "@/lib/functions";
import { Field, KeyValue, Money } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isoToUS, money, todayISO } from "@/lib/client/format";
import { useBillingSchedule, useRefreshLoans } from "@/lib/client/queries";
import { rpc } from "@/lib/client/rpc";
import { cn } from "@/lib/client/utils";

export const PAYMENT_METHODS = ["Cash", "GCash", "Bank transfer", "BPI", "MariBank", "Check", "Other"];

type PaymentResult = { success: true; staleEmail: { type: string; date: string; time: string } | null; receiptSent: boolean; mailMsg: string; waiver: boolean; waived: number; waivedUnused: number; receiptNo: string };

const schema = z.object({
  kind: z.enum(["payment", "waiver"]),
  month: z.string().min(1, "Choose the billing month."),
  amount: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0, "Enter an amount greater than 0."),
  date: z.string().min(1, "Choose the date."),
  method: z.string().min(1),
  receiptNo: z.string().trim(),
});
type Values = z.infer<typeof schema>;

export function RecordPaymentForm({ loan, onDone, onCancel }: { loan: LoanDetail; onDone?: () => void; onCancel?: () => void }) {
  const refresh = useRefreshLoans();
  const { data: sched } = useBillingSchedule(loan.rowIndex);
  const next = loan.nextBillDetails;
  const owedCharges = (loan.money.penaltiesOwed || 0) + (loan.money.lateFeesOwed || 0);

  const defaults = React.useMemo<Values>(
    () => ({
      kind: "payment",
      month: next ? next.overdueMonth || next.month : "",
      amount: next ? String(next.overdueMonth ? next.overdueSeparate : next.totalDue) : "",
      date: todayISO(),
      method: "Cash",
      receiptNo: "",
    }),
    [next],
  );
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const kind = form.watch("kind");
  const method = form.watch("method");
  const month = form.watch("month");
  const errors = form.formState.errors;

  const months = React.useMemo(() => {
    const list = (sched?.schedule ?? []).map((r) => r.month);
    if (month && !list.includes(month)) list.push(month);
    return list;
  }, [sched, month]);

  function setKind(k: Values["kind"]) {
    form.setValue("kind", k);
    form.setValue("amount", k === "waiver" ? (owedCharges > 0 ? String(owedCharges) : "") : defaults.amount);
    form.setValue("method", k === "waiver" ? "Fee/Interest Waiver" : "Cash");
  }

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const res = await rpc("recordPayment", loan.rowIndex, v.month, Number(v.amount), isoToUS(v.date), v.receiptNo, v.kind === "waiver" ? "Fee/Interest Waiver" : v.method);
      if (!res.success) throw new Error(res.msg || "Couldn't record the payment.");
      return res as PaymentResult;
    },
    onSuccess: (res) => {
      refresh(loan.rowIndex);
      if (res.waiver) {
        toast.success("Waiver recorded", { description: res.waived > 0 ? `${money(res.waived)} of penalties and late fees forgiven.${res.waivedUnused > 0 ? ` ${money(res.waivedUnused)} was more than what was charged and was not used.` : ""}` : "Nothing was charged yet, so no amount was forgiven." });
      } else {
        toast.success("Payment recorded", { description: res.receiptSent ? "A receipt was emailed to the borrower." : undefined });
      }
      if (!res.receiptSent) toast.warning("Receipt email not sent", { description: res.mailMsg || "Resend it from the Payments tab." });
      if (res.staleEmail) {
        const what = res.staleEmail.type === "statement" ? "statement" : "payment reminder";
        toast.warning("The borrower may have an outdated email", {
          description: `A ${what} was sent on ${res.staleEmail.date} at ${res.staleEmail.time}, before this payment was recorded. It may say they are unpaid or overdue.`,
          duration: 60000,
          action: {
            label: "Send corrected statement",
            onClick: () => {
              void rpc("sendMonthlyStatement", loan.rowIndex).then((m) =>
                typeof m === "string" && m.includes("\u274C") ? toast.error("Statement not sent", { description: m.replace(/^\S+\s*/, "") }) : toast.success("Corrected statement sent"),
              );
            },
          },
        });
      }
      onDone?.();
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  if (!next && loan.balance <= 0) {
    return <Alert variant="success">This loan is fully paid. There is nothing left to record.</Alert>;
  }

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
      <div role="tablist" aria-label="Entry type" className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1">
        {(
          [
            { id: "payment", label: "Payment", icon: Banknote },
            { id: "waiver", label: "Waive charges", icon: Ban },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={kind === t.id}
            onClick={() => setKind(t.id)}
            className={cn("flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", kind === t.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {next ? (
        <div className="rounded-lg border bg-muted/30 p-3.5">
          <KeyValue
            rows={[
              { label: "Next payment", value: <Money value={next.bill} /> },
              { label: "Overdue amount", value: <Money value={next.overdueAmount} className={next.overdueAmount > 0 ? "text-destructive" : ""} />, hide: !(next.overdueAmount > 0) },
              { label: "Penalties and late fees charged", value: <Money value={loan.money.chargesOwed} />, hide: !(loan.money.chargesOwed > 0) },
              { label: "Total owed now", value: <Money value={loan.balance} className="font-semibold" /> },
            ]}
          />
        </div>
      ) : null}

      {kind === "waiver" ? (
        <Alert variant="warning">
          A waiver forgives penalties and late fees. It is <b>not</b> cash, so it is not counted as money received. It can never forgive more than what was actually charged.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="For billing month" required error={errors.month?.message}>
          <Select value={month} onValueChange={(v) => form.setValue("month", v, { shouldValidate: true })}>
            <SelectTrigger aria-label="Billing month" aria-invalid={!!errors.month}>
              <SelectValue placeholder="Choose a month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={kind === "waiver" ? "Amount to waive (₱)" : "Amount received (₱)"} htmlFor="pay-amount" required error={errors.amount?.message}>
          <Input id="pay-amount" inputMode="decimal" {...form.register("amount")} aria-invalid={!!errors.amount} />
        </Field>
        <Field label="Date" htmlFor="pay-date" required error={errors.date?.message}>
          <Input id="pay-date" type="date" {...form.register("date")} aria-invalid={!!errors.date} />
        </Field>
        {kind === "payment" ? (
          <Field label="Method">
            <Select value={method} onValueChange={(v) => form.setValue("method", v)}>
              <SelectTrigger aria-label="Payment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Reference / receipt no." htmlFor="pay-ref" hint="Optional. One is generated if you leave it empty." className={kind === "waiver" ? "" : "sm:col-span-2"}>
          <Input id="pay-ref" {...form.register("receiptNo")} />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={save.isPending}>
          {kind === "waiver" ? "Record waiver" : "Record payment and email receipt"}
        </Button>
      </div>
    </form>
  );
}
