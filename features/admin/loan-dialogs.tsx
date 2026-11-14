"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import type { LoanDetail } from "@/lib/functions";
import { Field, Money } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useRefreshLoans } from "@/lib/client/queries";
import { rpc, rpcRead } from "@/lib/client/rpc";
import { bankMonthlyFromRate, bankRateFromMonthly } from "@/lib/loan-math";
import { LoanFormFields, NO_BANK, toServerPayload, useLoanForm } from "./loan-form";
import { RecordPaymentForm } from "./payment-form";

export function PaymentDialog({ loan, open, onOpenChange }: { loan: LoanDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {loan.borrowerName} · {loan.loanName}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <RecordPaymentForm loan={loan} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function EditLoanSheet({ loan, open, onOpenChange }: { loan: LoanDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useRefreshLoans();
  const form = useLoanForm({
    name: loan.borrowerName,
    email: loan.email,
    contact: loan.contactNumber,
    address: loan.address,
    idNum: loan.validId,
    ccEmail: loan.ccEmail,
    loanType: loan.loanType,
    loanName: loan.loanName,
    startDate: loan.startDateISO,
    principal: String(loan.originalAmount),
    terms: String(loan.terms),
    rate: String(parseFloat(loan.monthlyRate)),
    fee: String(loan.processingFee),
    partner: loan.partner || NO_BANK,
    dueDay: loan.partner ? "" : String(loan.dueDay),
    lateFee: loan.lateFee ? String(loan.lateFee) : "",
    lateFeeFrom: loan.lateFeeFromISO,
  });
  React.useEffect(() => {
    if (open) form.reset(form.formState.defaultValues as never);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async (v: Parameters<Parameters<typeof form.handleSubmit>[0]>[0]) => {
      const res = await rpc("updateBorrower", loan.rowIndex, toServerPayload(v, { includeBankCost: false }));
      if (!res.success) throw new Error(res.msg || "Couldn't save the changes.");
    },
    onSuccess: () => {
      refresh(loan.rowIndex);
      toast.success("Loan updated");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="flex min-h-0 flex-1 flex-col">
          <SheetHeader>
            <SheetTitle>Edit loan</SheetTitle>
            <SheetDescription>Changing the terms recalculates the schedule and what the borrower owes. Recorded payments are kept.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <LoanFormFields form={form} mode="edit" />
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

interface CostValues {
  terms: string;
  rate: string;
  monthly: string;
  fee: string;
}

export function BankCostDialog({ loan, open, onOpenChange }: { loan: LoanDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useRefreshLoans();
  const form = useForm<CostValues>({
    defaultValues: { terms: loan.bankTerms ? String(loan.bankTerms) : "", rate: "", monthly: loan.bankMonthly ? String(loan.bankMonthly) : "", fee: loan.bankFee ? String(loan.bankFee) : "" },
  });
  React.useEffect(() => {
    if (open) form.reset({ terms: loan.bankTerms ? String(loan.bankTerms) : "", rate: "", monthly: loan.bankMonthly ? String(loan.bankMonthly) : "", fee: loan.bankFee ? String(loan.bankFee) : "" });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [terms, monthly] = form.watch(["terms", "monthly"]);
  const months = Number(terms) || loan.terms;
  const implied = bankRateFromMonthly(loan.originalAmount, Number(monthly), months);

  const save = useMutation({
    mutationFn: async (v: CostValues) => {
      const res = await rpc("setBankCost", loan.rowIndex, Number(v.monthly) || 0, Number(v.fee) || 0, Number(v.terms) || 0);
      if (!res.success) throw new Error(res.msg || "Couldn't save.");
    },
    onSuccess: () => {
      refresh(loan.rowIndex);
      toast.success("Bank cost saved");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Your cost from the bank</DialogTitle>
            <DialogDescription>Private. Only used for your profit figures. It never affects what the borrower owes.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Months the bank bills" htmlFor="bc-terms" hint={`Defaults to the loan term (${loan.terms}).`}>
                <Input id="bc-terms" inputMode="numeric" {...form.register("terms")} />
              </Field>
              <Field label="Bank interest per month (%)" htmlFor="bc-rate" hint="Type this to work out the payment.">
                <Input
                  id="bc-rate"
                  inputMode="decimal"
                  placeholder={implied > 0 ? implied.toFixed(2) : ""}
                  {...form.register("rate", {
                    onChange: (e) => {
                      const m = bankMonthlyFromRate(loan.originalAmount, Number(e.target.value), months);
                      form.setValue("monthly", m > 0 ? String(m) : "");
                    },
                  })}
                />
              </Field>
              <Field label="Bank monthly payment (₱)" htmlFor="bc-monthly">
                <Input id="bc-monthly" inputMode="decimal" {...form.register("monthly", { onChange: () => form.setValue("rate", "") })} />
              </Field>
              <Field label="Bank one-time fee (₱)" htmlFor="bc-fee">
                <Input id="bc-fee" inputMode="decimal" {...form.register("fee")} />
              </Field>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Amount borrowed: <Money value={loan.originalAmount} />
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteLoanDialog({ loan, open, onOpenChange }: { loan: LoanDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const refresh = useRefreshLoans();
  const del = useMutation({
    mutationFn: async () => {
      const res = await rpc("deleteBorrower", loan.rowIndex);
      if (!res.success) throw new Error(res.msg || "Couldn't delete.");
    },
    onSuccess: () => {
      refresh();
      toast.success("Loan deleted");
      router.replace("/admin");
    },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <b>{loan.loanName}</b> for {loan.borrowerName} and all of its payments. If it is their only loan, their borrower record and portal login are removed too. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              del.mutate();
            }}
          >
            {del.isPending ? "Deleting…" : "Delete loan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Statement of account / loan agreement, rendered from the server's HTML and printable. */
export function DocumentDialog({ row, type, onClose }: { row: number; type: "soa" | "agreement" | null; onClose: () => void }) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const q = useQuery({
    queryKey: ["document", row, type],
    enabled: !!type,
    gcTime: 0,
    queryFn: () => rpcRead("getDocumentHtml", row, type as string),
  });
  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="h-[92dvh]">
        <DialogHeader>
          <DialogTitle>{type === "agreement" ? "Loan agreement" : "Statement of account"}</DialogTitle>
          <DialogDescription>Preview. Use Print and choose “Save as PDF” to keep a copy.</DialogDescription>
        </DialogHeader>
        <DialogBody className="bg-muted/40 p-0">
          {q.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-[60dvh] w-full" />
            </div>
          ) : q.error ? (
            <div className="p-5">
              <Alert variant="danger">{(q.error as Error).message}</Alert>
            </div>
          ) : (
            <iframe ref={frame} title="Document preview" className="h-full min-h-[70dvh] w-full bg-white" sandbox="allow-same-origin allow-modals" srcDoc={q.data?.html} />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button disabled={!q.data} onClick={() => frame.current?.contentWindow?.print()}>
            <Printer /> Print / save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
