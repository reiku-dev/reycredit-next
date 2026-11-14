/**
 * Loan arithmetic shared by every loan form (new borrower, edit loan, add loan).
 * Pure functions only, so the browser and the tests use exactly the same maths.
 */

export interface LoanFigures {
  interest: number;
  /** principal + interest + processing fee */
  total: number;
  /** monthly amortization: (principal + interest) / terms. The fee is billed once, on top. */
  amort: number;
}

/**
 * Interest is a flat add-on per month on the amount borrowed. The processing fee is billed once, on the
 * first cycle, on top of the monthly amortization, which is how the engine defines total payable
 * (amort x terms + fee). Dividing the fee-inclusive total by the terms would count the fee twice.
 */
export function loanPreview(input: { principal: number; rate: number; terms: number; fee: number }): LoanFigures {
  const principal = Number(input.principal) || 0;
  const rate = Number(input.rate) || 0;
  const terms = Number(input.terms) || 0;
  const fee = Number(input.fee) || 0;
  const interest = principal * (rate / 100) * terms;
  const total = principal + interest + fee;
  const amort = terms > 0 ? (principal + interest) / terms : 0;
  return { interest, total, amort };
}

/** Bank interest entered as a % per month (flat add-on on the amount borrowed) -> the bank's monthly payment. */
export function bankMonthlyFromRate(principal: number, ratePct: number, months: number): number {
  principal = Number(principal) || 0;
  ratePct = Number(ratePct) || 0;
  months = Number(months) || 0;
  if (principal <= 0 || ratePct <= 0 || months <= 0) return 0;
  return Math.round(((principal * (1 + (ratePct / 100) * months)) / months) * 100) / 100;
}

/** The inverse: the bank's monthly payment -> its flat % per month. */
export function bankRateFromMonthly(principal: number, monthly: number, months: number): number {
  principal = Number(principal) || 0;
  monthly = Number(monthly) || 0;
  months = Number(months) || 0;
  if (principal <= 0 || monthly <= 0 || months <= 0) return 0;
  return ((monthly * months - principal) / principal / months) * 100;
}
