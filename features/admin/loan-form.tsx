"use client";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Lock } from "lucide-react";
import { Field, KeyValue, Money } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useBanks, useConfig } from "@/lib/client/queries";
import { todayISO } from "@/lib/client/format";
import { bankMonthlyFromRate, bankRateFromMonthly, loanPreview } from "@/lib/loan-math";

const num = (label: string, opts: { min?: number; max?: number; int?: boolean; required?: boolean } = {}) =>
  z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (v === "") {
        if (opts.required) ctx.addIssue({ code: "custom", message: `Enter ${label}.` });
        return;
      }
      const n = Number(v);
      if (!Number.isFinite(n)) return void ctx.addIssue({ code: "custom", message: `${label} must be a number.` });
      if (opts.int && !Number.isInteger(n)) return void ctx.addIssue({ code: "custom", message: `${label} must be a whole number.` });
      if (opts.min != null && n < opts.min) ctx.addIssue({ code: "custom", message: `${label} must be at least ${opts.min}.` });
      if (opts.max != null && n > opts.max) ctx.addIssue({ code: "custom", message: `${label} can't be more than ${opts.max}.` });
    });

export const loanFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the borrower's full name."),
  email: z.string().trim().min(1, "Enter an email address.").email("That doesn't look like an email address."),
  contact: z.string().trim(),
  address: z.string().trim(),
  idNum: z.string().trim(),
  ccEmail: z.string().trim().refine((v) => !v || z.string().email().safeParse(v).success, "That doesn't look like an email address."),
  loanType: z.string().trim().min(1, "Choose a loan type."),
  loanName: z.string().trim().min(1, "Give the loan a name."),
  startDate: z.string().min(1, "Choose the start date."),
  principal: num("the amount borrowed", { min: 1, required: true }),
  terms: num("the number of months", { min: 1, max: 120, int: true, required: true }),
  rate: num("the monthly rate", { min: 0, max: 100, required: true }),
  fee: num("the processing fee", { min: 0 }),
  partner: z.string(),
  dueDay: num("the due day", { min: 1, max: 31, int: true }),
  lateFee: num("the late fee", { min: 0 }),
  lateFeeFrom: z.string(),
  bankTerms: num("the bank's months", { min: 0, int: true }),
  bankMonthly: num("the bank's monthly payment", { min: 0 }),
  bankFee: num("the bank's fee", { min: 0 }),
});
export type LoanFormValues = z.infer<typeof loanFormSchema>;

export const NO_BANK = "__none";
export const LOAN_TYPES = ["Cash Loan", "Item Loan", "Salary Loan", "Business Loan", "Other"];

export function emptyLoanForm(defaults: Partial<LoanFormValues> = {}): LoanFormValues {
  return {
    name: "", email: "", contact: "", address: "", idNum: "", ccEmail: "",
    loanType: "Cash Loan", loanName: "", startDate: todayISO(), principal: "", terms: "", rate: "", fee: "0",
    partner: NO_BANK, dueDay: "", lateFee: "", lateFeeFrom: "", bankTerms: "", bankMonthly: "", bankFee: "",
    ...defaults,
  };
}

/** The payload shape the server's addNewBorrower / addLoanToExistingBorrower / updateBorrower expect. */
export function toServerPayload(v: LoanFormValues, opts: { includeBankCost: boolean }) {
  const principal = Number(v.principal) || 0, terms = Number(v.terms) || 0, rate = Number(v.rate) || 0, fee = Number(v.fee) || 0;
  const f = loanPreview({ principal, rate, terms, fee });
  const payload: Record<string, unknown> = {
    name: v.name, email: v.email, contact: v.contact, address: v.address, idNum: v.idNum, ccEmail: v.ccEmail,
    loanType: v.loanType, loanName: v.loanName, startDate: v.startDate,
    principal, terms, rate, fee,
    totalInterest: round2(f.interest), totalPayable: round2(f.total), monthlyAmort: round2(f.amort),
    partner: v.partner === NO_BANK ? "" : v.partner, dueDay: Number(v.dueDay) || 0,
    lateFee: Number(v.lateFee) || 0, lateFeeFrom: v.lateFeeFrom || "",
  };
  if (opts.includeBankCost && (v.bankMonthly || v.bankFee || v.bankTerms)) {
    payload.bankMonthly = Number(v.bankMonthly) || 0;
    payload.bankFee = Number(v.bankFee) || 0;
    payload.bankTerms = Number(v.bankTerms) || 0;
  }
  return payload;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export function useLoanForm(defaults?: Partial<LoanFormValues>) {
  return useForm<LoanFormValues>({ resolver: zodResolver(loanFormSchema), defaultValues: emptyLoanForm(defaults), mode: "onTouched" });
}

type Form = ReturnType<typeof useLoanForm>;

function Section({ title, description, children, icon: Icon }: { title: string; description?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          {title}
        </h3>
        {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Shows the amounts the borrower will be billed, live as the terms are typed. */
export function LoanPreview({ form }: { form: Form }) {
  const [principal, rate, terms, fee] = useWatch({ control: form.control, name: ["principal", "rate", "terms", "fee"] });
  const f = loanPreview({ principal: Number(principal), rate: Number(rate), terms: Number(terms), fee: Number(fee) });
  const ready = Number(principal) > 0 && Number(terms) > 0;
  return (
    <Card className="bg-muted/30 p-4 shadow-none" aria-live="polite">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What the borrower will pay</p>
      <KeyValue
        rows={[
          { label: "Total interest", value: ready ? <Money value={f.interest} /> : "—" },
          { label: "Monthly amortization", value: ready ? <Money value={f.amort} /> : "—" },
          { label: "Processing fee (billed once)", value: <Money value={Number(fee) || 0} /> },
          { label: <span className="font-semibold text-foreground">Total payable</span>, value: ready ? <Money value={f.total} className="text-base font-semibold" /> : "—" },
        ]}
      />
    </Card>
  );
}

export function LoanFormFields({
  form,
  mode,
  lockBorrower,
}: {
  form: Form;
  mode: "new" | "addLoan" | "edit";
  /** For "addLoan": the borrower's details come from the existing record. */
  lockBorrower?: boolean;
}) {
  const { register, formState, control, setValue } = form;
  const e = formState.errors;
  const { data: banks } = useBanks();
  const { data: config } = useConfig();
  const partner = useWatch({ control, name: "partner" });
  const loanType = useWatch({ control, name: "loanType" });
  const [principal, terms, bankMonthly, bankTermsV] = useWatch({ control, name: ["principal", "terms", "bankMonthly", "bankTerms"] });
  const bank = banks?.find((b) => b.bank === partner);
  const [bankRate, setBankRate] = React.useState("");

  // Pre-fill the configured default late fee on a brand new loan.
  React.useEffect(() => {
    if (mode !== "edit" && config?.LATE_FEE_DEFAULT && !form.getValues("lateFee")) {
      const d = Number(config.LATE_FEE_DEFAULT) || 0;
      if (d > 0) setValue("lateFee", String(d));
    }
  }, [config, mode, form, setValue]);

  const bankMonths = Number(bankTermsV) || Number(terms) || 0;
  const impliedRate = bankRateFromMonthly(Number(principal), Number(bankMonthly), bankMonths);

  return (
    <div className="space-y-8">
      {mode !== "addLoan" || !lockBorrower ? (
        <Section title="Borrower" description="Contact details are used for statements and reminders.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="lf-name" required error={e.name?.message}>
              <Input id="lf-name" autoComplete="off" {...register("name")} aria-invalid={!!e.name} />
            </Field>
            <Field label="Email" htmlFor="lf-email" required error={e.email?.message} hint={mode === "new" ? "The borrower signs in with this address." : undefined}>
              <Input id="lf-email" type="email" autoComplete="off" {...register("email")} aria-invalid={!!e.email} />
            </Field>
            <Field label="Contact number" htmlFor="lf-contact" error={e.contact?.message}>
              <Input id="lf-contact" inputMode="tel" {...register("contact")} />
            </Field>
            <Field label="CC email" htmlFor="lf-cc" error={e.ccEmail?.message} hint="Optional. Copied on every email we send.">
              <Input id="lf-cc" type="email" {...register("ccEmail")} aria-invalid={!!e.ccEmail} />
            </Field>
            <Field label="Address" htmlFor="lf-address" className="sm:col-span-2">
              <Input id="lf-address" {...register("address")} />
            </Field>
            <Field label="Valid ID number" htmlFor="lf-id" className="sm:col-span-2">
              <Input id="lf-id" {...register("idNum")} />
            </Field>
          </div>
        </Section>
      ) : null}

      <Section title="Loan terms" description="Interest is a flat monthly rate on the amount borrowed.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loan type" required error={e.loanType?.message}>
            <Select value={loanType} onValueChange={(v) => setValue("loanType", v, { shouldValidate: true })}>
              <SelectTrigger aria-label="Loan type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Set([...LOAN_TYPES, loanType])).filter(Boolean).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Loan name" htmlFor="lf-loan" required error={e.loanName?.message} hint="Shown on statements, e.g. “Credit-To-Cash (20K)”.">
            <Input id="lf-loan" {...register("loanName")} aria-invalid={!!e.loanName} />
          </Field>
          <Field label="Amount borrowed (₱)" htmlFor="lf-principal" required error={e.principal?.message}>
            <Input id="lf-principal" inputMode="decimal" {...register("principal")} aria-invalid={!!e.principal} />
          </Field>
          <Field label="Start date" htmlFor="lf-start" required error={e.startDate?.message}>
            <Input id="lf-start" type="date" {...register("startDate")} aria-invalid={!!e.startDate} />
          </Field>
          <Field label="Term (months)" htmlFor="lf-terms" required error={e.terms?.message}>
            <Input id="lf-terms" inputMode="numeric" {...register("terms")} aria-invalid={!!e.terms} />
          </Field>
          <Field label="Interest per month (%)" htmlFor="lf-rate" required error={e.rate?.message}>
            <Input id="lf-rate" inputMode="decimal" {...register("rate")} aria-invalid={!!e.rate} />
          </Field>
          <Field label="Processing fee (₱)" htmlFor="lf-fee" error={e.fee?.message} hint="Charged once, on the first bill.">
            <Input id="lf-fee" inputMode="decimal" {...register("fee")} aria-invalid={!!e.fee} />
          </Field>
          <Field label="Late payment fee (₱)" htmlFor="lf-late" error={e.lateFee?.message} hint="Optional flat fee added to each late cycle.">
            <Input id="lf-late" inputMode="decimal" {...register("lateFee")} aria-invalid={!!e.lateFee} />
          </Field>
          {mode === "edit" ? (
            <Field label="Late fee starts" htmlFor="lf-late-from" hint="Leave empty to start from today when adding a fee to an existing loan.">
              <Input id="lf-late-from" type="date" {...register("lateFeeFrom")} />
            </Field>
          ) : null}
        </div>
        <LoanPreview form={form} />
      </Section>

      <Section title="Billing" description="The bank decides the statement and due dates.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank / partner">
            <Select value={partner} onValueChange={(v) => setValue("partner", v)}>
              <SelectTrigger aria-label="Bank">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BANK}>No bank (own due day)</SelectItem>
                {(banks ?? []).map((b) => (
                  <SelectItem key={b.row} value={b.bank}>
                    {b.bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {partner === NO_BANK || !bank ? (
            <Field label="Due day of the month" htmlFor="lf-due" error={e.dueDay?.message} hint="1–31. Defaults to the 1st.">
              <Input id="lf-due" inputMode="numeric" {...register("dueDay")} aria-invalid={!!e.dueDay} />
            </Field>
          ) : (
            <div className="flex items-end">
              <p className="rounded-lg border bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground">
                <Building2 className="mr-1.5 inline size-3.5" />
                Statement on day <b className="text-foreground">{bank.statementDay}</b>, due on day <b className="text-foreground">{bank.dueDay}</b> ({bank.dueMonth.toLowerCase()}).
              </p>
            </div>
          )}
        </div>
      </Section>

      {mode !== "edit" ? (
        <Section title="Your cost from the bank" icon={Lock} description="Private. Used only for your profit report. It is never shown to the borrower or included in any email.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Months the bank bills" htmlFor="lf-bterms" error={e.bankTerms?.message} hint="Leave empty if it matches the loan term.">
              <Input id="lf-bterms" inputMode="numeric" {...register("bankTerms")} />
            </Field>
            <Field label="Bank interest per month (%)" htmlFor="lf-brate" hint="Type this to work out the monthly payment.">
              <Input
                id="lf-brate"
                inputMode="decimal"
                value={bankRate}
                placeholder={impliedRate > 0 ? impliedRate.toFixed(2) : ""}
                onChange={(ev) => {
                  setBankRate(ev.target.value);
                  const m = bankMonthlyFromRate(Number(principal), Number(ev.target.value), bankMonths);
                  setValue("bankMonthly", m > 0 ? String(m) : "");
                }}
              />
            </Field>
            <Field label="Bank monthly payment (₱)" htmlFor="lf-bmonthly" error={e.bankMonthly?.message}>
              <Input id="lf-bmonthly" inputMode="decimal" {...register("bankMonthly", { onChange: () => setBankRate("") })} />
            </Field>
            <Field label="Bank one-time fee (₱)" htmlFor="lf-bfee" error={e.bankFee?.message}>
              <Input id="lf-bfee" inputMode="decimal" {...register("bankFee")} />
            </Field>
          </div>
        </Section>
      ) : null}

      {Object.keys(e).length > 0 ? <Alert variant="danger">Please fix the highlighted fields.</Alert> : null}
    </div>
  );
}
