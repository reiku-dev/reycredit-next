import { notFound } from "next/navigation";
import { LoanPage } from "@/features/admin/loan-page";

export default function Loan({ params }: { params: { row: string } }) {
  const row = Number(params.row);
  if (!Number.isInteger(row) || row <= 0) notFound();
  return <LoanPage row={row} />;
}
