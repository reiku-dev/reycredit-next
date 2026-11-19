/**
 * Shared domain types. The engine (lib/engine.ts) is pure; everything it
 * receives and returns is described here so the server functions and the
 * React front-end agree on one vocabulary.
 */

export type Config = Record<string, string>;

/** How a financing partner (the bank) shapes billing dates. */
export interface BankRule {
  statementDay: number;
  dueDay: number;
  sameMonth: boolean;
}

/** A recorded payment as the engine sees it. */
export interface EnginePayment {
  month: string;
  amount: number;
  date: Date | null;
  receiptNo: string;
  method: string;
  waiver?: boolean;
}

/** A loan as the engine sees it (already merged with its bank rule). */
export interface EngineLoan {
  id?: number;
  loanName?: string;
  startDate: Date | string | null;
  totalPayable: number;
  totalInterest?: number;
  principal?: number;
  terms: number;
  monthlyAmort: number;
  processingFee: number;
  bank: BankRule | null;
  dueDay?: number | string;
  lateFee?: number;
  lateFeeFrom?: Date | string | null;
  /** This loan's own monthly penalty %, as stated in its agreement. null/undefined = use the company default. */
  penaltyRate?: number | null;
  /** A Date = cutoff for the due-date penalty rule, null = new rule for all cycles, undefined = default. */
  penaltyFrom?: Date | null;
  bankMonthly?: number;
  bankFee?: number;
  bankTerms?: number;
  [extra: string]: unknown;
}

/** A bank as the server loads it for billing (rule + display name). */
export interface BankInfo extends BankRule {
  name: string;
  id?: number;
}

export type CycleStatus = "PAID" | "PARTIAL" | "PAST_TERM" | "OVERDUE" | "FOR_PAYMENT" | "PENDING";

export interface ScheduleRow {
  month: string;
  dueDate: string;
  dueDateObj: Date;
  isPast: boolean;
  bill: number;
  amort: number;
  fee: number;
  carryIn: number;
  paid: number;
  payDate: string;
  payDateObj: Date | null;
  receiptNo: string;
  outstanding: number;
  penalty: number;
  lateFee: number;
  penaltyWaived: number;
  lateFeeWaived: number;
  carryOut: number;
  isExtension: boolean;
  monthsAgo: number;
  recency: number;
  status: CycleStatus;
}

export interface WaiverSummary {
  total: number;
  applied: number;
  unused: number;
  list: { index: number; amount: number; applied: number; unused: number }[];
}

export interface BuiltSchedule {
  schedule: ScheduleRow[];
  bank: BankRule | null;
  firstDue: Date;
  termsMismatch: boolean;
  expectedPayable: number;
  statedPayable: number;
  impliedAmort: number;
  waivers: WaiverSummary;
}

export type StatusCode =
  | "FULLY_PAID" | "DELINQUENT" | "PAST_TERM" | "OVERDUE" | "LACKING_PAYMENT" | "PARTIAL"
  | "DUE_SOON" | "UPDATED" | "PAID" | "FOR_PAYMENT" | "IN_PROGRESS" | "PENDING";

export type Tone = "success" | "warning" | "danger";

/* ---------- Database rows (see supabase-schema.sql and the add-on .sql files) ---------- */

export interface BorrowerRow {
  id: number;
  name: string;
  email: string;
  contact: string | null;
  address: string | null;
  valid_id: string | null;
  cc_email: string | null;
  created_at?: string;
}

export interface BankRow {
  id: number;
  name: string;
  statement_day: number;
  due_day: number;
  due_month: "Next Month" | "Same Month";
}

export interface LoanRow {
  id: number;
  borrower_id: number;
  loan_name: string;
  loan_type: string | null;
  start_date: string;
  principal: number;
  terms: number;
  monthly_rate: number;
  processing_fee: number;
  total_interest: number;
  total_payable: number;
  monthly_amort: number;
  bank_id: number | null;
  due_day: number | null;
  closed: boolean;
  late_fee?: number | null;
  late_fee_from?: string | null;
  penalty_rate?: number | null;
  bank_monthly?: number | null;
  bank_fee?: number | null;
  bank_terms?: number | null;
  borrowers?: BorrowerRow | null;
  [column: string]: unknown;
}

export type LoanWithBorrower = LoanRow & { borrowers: BorrowerRow };

export interface PaymentRow {
  id: number;
  loan_id: number;
  for_month: string;
  amount: number;
  paid_date: string | null;
  receipt_no: string | null;
  method: string | null;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: "ADMIN" | "BORROWER";
}

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}
