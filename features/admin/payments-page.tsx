"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorState, Field, PageHeader, SectionCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isClosed } from "@/lib/client/format";
import { useLoanDetail, useLoans } from "@/lib/client/queries";
import { RecordPaymentForm } from "./payment-form";

export function PaymentsPage() {
  const params = useSearchParams();
  const { data: loans, isLoading } = useLoans();
  const [row, setRow] = React.useState<number | null>(params.get("loan") ? Number(params.get("loan")) : null);
  const [formKey, setFormKey] = React.useState(0);
  const detail = useLoanDetail(row);
  const open = (loans ?? []).filter((l) => !isClosed(l.status));

  return (
    <>
      <PageHeader title="Record payment" description="Log money received from a borrower, or waive penalties. The borrower gets a receipt by email." />
      <div className="mx-auto max-w-2xl space-y-5">
        <SectionCard>
          <Field label="Loan">
            <Select value={row ? String(row) : ""} onValueChange={(v) => setRow(Number(v))} disabled={isLoading}>
              <SelectTrigger aria-label="Loan">
                <SelectValue placeholder={isLoading ? "Loading loans…" : "Choose a loan"} />
              </SelectTrigger>
              <SelectContent>
                {open.map((l) => (
                  <SelectItem key={l.rowIndex} value={String(l.rowIndex)}>
                    {l.name} · {l.loan} · {l.balance}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </SectionCard>

        {!row ? (
          <SectionCard>
            <EmptyState icon={CreditCard} title="Choose a loan to continue" text="Pick the borrower's loan above and the form appears here." />
          </SectionCard>
        ) : detail.isLoading ? (
          <CardSkeleton rows={5} />
        ) : detail.error ? (
          <SectionCard>
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          </SectionCard>
        ) : detail.data ? (
          <SectionCard
            title={detail.data.borrowerName}
            description={detail.data.loanName}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/loans/${detail.data.rowIndex}`}>View loan</Link>
              </Button>
            }
          >
            <RecordPaymentForm key={`${detail.data.rowIndex}-${formKey}-${detail.dataUpdatedAt}`} loan={detail.data} onDone={() => setFormKey((k) => k + 1)} />
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
