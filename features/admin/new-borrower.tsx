"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, UserPlus, Users } from "lucide-react";
import { CopyButton, Field, PageHeader, SectionCard } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/client/utils";
import { useLoans, useRefreshLoans } from "@/lib/client/queries";
import { rpc } from "@/lib/client/rpc";
import { LoanFormFields, toServerPayload, useLoanForm } from "./loan-form";

type Mode = "new" | "existing";

export function NewBorrower() {
  const router = useRouter();
  const refresh = useRefreshLoans();
  const { data: loans } = useLoans();
  const [mode, setMode] = React.useState<Mode>("new");
  const [existing, setExisting] = React.useState("");
  const [created, setCreated] = React.useState<{ row: number; pin?: string; msg: string } | null>(null);
  const form = useLoanForm();

  const borrowers = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of loans ?? []) if (!m.has(l.email)) m.set(l.email, l.name);
    return Array.from(m, ([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [loans]);

  React.useEffect(() => {
    if (mode === "existing" && existing) {
      const b = borrowers.find((x) => x.email === existing);
      if (b) {
        form.setValue("email", b.email);
        form.setValue("name", b.name);
      }
    } else if (mode === "new") {
      form.setValue("email", "");
      form.setValue("name", "");
    }
  }, [mode, existing, borrowers, form]);

  const save = useMutation({
    mutationFn: async (values: Parameters<Parameters<typeof form.handleSubmit>[0]>[0]) => {
      const payload = toServerPayload(values, { includeBankCost: true });
      const res = mode === "new" ? await rpc("addNewBorrower", payload) : await rpc("addLoanToExistingBorrower", payload);
      if (!res.success) throw new Error(res.msg || "Couldn't save the loan.");
      return res as { success: true; msg: string; rowIndex: number; pin?: string };
    },
    onSuccess: (res) => {
      refresh(res.rowIndex);
      toast.success(mode === "new" ? "Borrower added" : "Loan added", { description: res.msg });
      if (res.pin) setCreated({ row: res.rowIndex, pin: res.pin, msg: res.msg });
      else router.push(`/admin/loans/${res.rowIndex}`);
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="New loan"
        description="Add a new borrower, or add another loan to someone who already borrows from you."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeft /> Back
            </Link>
          </Button>
        }
      />

      <form
        onSubmit={form.handleSubmit((v) => {
          if (mode === "existing" && !existing) return void toast.error("Choose which borrower this loan is for.");
          save.mutate(v);
        })}
        noValidate
        className="mx-auto max-w-3xl space-y-5"
      >
        <div role="tablist" aria-label="Borrower type" className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1">
          {(
            [
              { id: "new", label: "New borrower", icon: UserPlus },
              { id: "existing", label: "Existing borrower", icon: Users },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => setMode(t.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          <SectionCard title="Borrower">
            <Field label="Who is this loan for?" required>
              <Select value={existing} onValueChange={setExisting}>
                <SelectTrigger aria-label="Existing borrower">
                  <SelectValue placeholder="Choose a borrower" />
                </SelectTrigger>
                <SelectContent>
                  {borrowers.map((b) => (
                    <SelectItem key={b.email} value={b.email}>
                      {b.name} · {b.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </SectionCard>
        ) : null}

        <SectionCard contentClassName="px-5 pb-5 pt-5">
          <LoanFormFields form={form} mode={mode === "new" ? "new" : "addLoan"} lockBorrower={mode === "existing"} />
        </SectionCard>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link href="/admin">Cancel</Link>
          </Button>
          <Button type="submit" loading={save.isPending}>
            {mode === "new" ? "Save borrower and email agreement" : "Save loan and email agreement"}
          </Button>
        </div>
      </form>

      <Dialog open={!!created} onOpenChange={(o) => !o && created && router.push(`/admin/loans/${created.row}`)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Borrower added</DialogTitle>
            <DialogDescription>{created?.msg}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Alert variant="info">
              The sign-in PIN below was also emailed to the borrower. It is shown only now. If the email didn't arrive, share it yourself.
            </Alert>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="size-4" /> Temporary PIN
              </span>
              <span className="num text-2xl font-semibold tracking-[0.3em]">{created?.pin}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            {created?.pin ? <CopyButton text={created.pin} label="Copy PIN" /> : null}
            <Button onClick={() => created && router.push(`/admin/loans/${created.row}`)}>Open loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
