/** A waiver forgives penalties / late fees. It lowers what is owed but is NOT money received: it must never
 *  count as cash, as principal/interest/fee paid, as a collection, or as an on-time payment. */
const Module = require("module");
const { makeFakeDb } = require("./fake-supabase.js");

const RealDate = Date;
const fixed = new RealDate("2026-11-13T04:00:00Z").getTime();
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };

const tables = {
  borrowers: [], loans: [], payments: [], users: [], email_log: [], banks: [],
  config: [{ key: "PENALTY_RATE", value: "3" }, { key: "COMPANY_NAME", value: "Rey Credit" }, { key: "LENDER_NAME", value: "Rey F." },
    { key: "SUPPORT_EMAIL", value: "b@x.com" }, { key: "SUPPORT_PHONE", value: "0968" }, { key: "COMPANY_ADDR", value: "Rizal" }, { key: "LENDER_ADDR", value: "Rizal" },
    { key: "PORTAL_URL", value: "https://x" }, { key: "GCASH_ACCOUNT", value: "0968" }, { key: "BPI_ACCOUNT", value: "065" }, { key: "MARIBANK_ACCOUNT", value: "171" }, { key: "OFFICE_HOURS", value: "Mon-Sat" }],
};
const fakeDb = makeFakeDb(tables);
const sent = [];
const orig = Module._load;
Module._load = function (request) {
  if (request.endsWith("/supabase") || request === "./supabase") return { db: () => fakeDb };
  if (request.endsWith("/mailer") || request === "./mailer") return { sendMail: async (m) => { sent.push(m); return { success: true, id: "rs" }; } };
  return orig.apply(this, arguments);
};
const E = require("../lib/engine");
const fns = require("../lib/functions");

let failures = 0;
const check = (label, cond, detail) => { console.log((cond ? "PASS " : "FAIL ") + label + (cond || !detail ? "" : "  -> " + detail)); if (!cond) failures++; };
const d = (s) => new RealDate(s + "T00:00:00");
const near = (a, b) => Math.abs(a - b) < 0.006;

// 2 x 1,000, 3% penalty, 200 late fee, first due Oct 8. Today is Nov 13.
const loan = { terms: 2, monthlyAmort: 1000, processingFee: 0, totalPayable: 2000, startDate: d("2026-09-20"), dueDay: 8, bank: null,
  lateFee: 200, lateFeeFrom: null, penaltyFrom: null, principal: 1800, totalInterest: 200, bankMonthly: 1500, bankFee: 0, bankTerms: 2 };
const pay = (amount, date, receiptNo, method, month) => ({ month: month || "October 2026", amount, date: d(date), receiptNo: receiptNo || "R" + amount, method: method || "GCash" });
const fig = (pays) => E.liveLoanFigures(loan, pays, 3);

(function engine() {
  const base = fig([pay(1230, "2026-10-20")]);
  const oct = (f) => f.built.schedule[0];
  check("baseline: Oct is late, so 30 penalty + 200 late fee were charged and paid", oct(base).penalty === 30 && oct(base).lateFee === 200 && base.money.chargesPaid === 230);

  // The real case: the borrower already paid the penalty, then the lender waived it.
  const w = fig([pay(1230, "2026-10-20"), pay(230, "2026-10-25", "Fee/Interest Waiver", "GCash")]);
  check("a waiver recorded with the reference 'Fee/Interest Waiver' is recognised (method says GCash)", E.isWaiver({ receiptNo: "Fee/Interest Waiver", method: "GCash" }));
  check("it is also recognised from the method alone, and a normal payment is not", E.isWaiver({ method: "Fee/Interest Waiver" }) && !E.isWaiver({ method: "GCash", receiptNo: "1631214793604" }));
  check("cash paid is unchanged: the waiver is not money received", w.paid === 1230 && w.money.instalmentsPaid + w.money.chargesPaid === 1230);
  check("the waiver removed the penalty and the late fee from the Oct cycle", oct(w).penalty === 0 && oct(w).lateFee === 0 && oct(w).penaltyWaived === 30 && oct(w).lateFeeWaived === 200);
  check("what the waiver covered is reported separately", w.money.waivedTotal === 230 && w.money.waivedPenalties === 30 && w.money.waivedLateFees === 200 && w.money.waivedUnused === 0);
  check("the balance fell by the waived 230", near(base.balance - w.balance, 230), base.balance + " -> " + w.balance);
  check("the 230 the borrower had already paid becomes a credit on the next bill, not penalty income", near(oct(w).carryOut, -230) && w.money.instalmentsPaid === 1230 && w.money.penaltiesPaid === 0 && w.money.lateFeesPaid === 0 && w.schedule === undefined && near(w.built.schedule[1].bill, 770));
  check("collected and net cash in your profit do not include the waiver (bank was paid 2 x 1,500 so far)", w.profit.collected === 1230 && w.profit.bankPaid === 3000 && w.profit.netCash === -1770);
  check("profit shows the charges given up", w.profit.extrasWaived === 230);

  // Waived before it was paid: the borrower owes less and pays less cash.
  const early = fig([pay(1000, "2026-10-20"), pay(230, "2026-10-25", "WV-1", "Fee/Interest Waiver")]);
  check("waiving charges that were not yet paid leaves nothing owing for them", oct(early).penalty === 0 && oct(early).lateFee === 0 && oct(early).outstanding <= 0 && early.paid === 1000);
  check("...and the borrower is not credited for money they never paid", early.money.overpaid === 0 && near(oct(early).carryOut, 0));

  // A waiver cannot forgive what was never charged.
  const big = fig([pay(1000, "2026-10-08"), pay(500, "2026-10-25", "WV-2", "Fee/Interest Waiver")]);
  check("a waiver for an on-time month has nothing to forgive: it is kept as unused, never as a credit", big.money.waivedTotal === 0 && big.money.waivedUnused === 500 && big.paid === 1000 && oct(big).carryOut === 0);
  const tooSoon = fig([pay(1230, "2026-10-20"), pay(230, "2026-10-05", "WV-3", "Fee/Interest Waiver")]);
  check("a waiver dated before the charge existed does not apply to it", tooSoon.money.waivedTotal === 0 && tooSoon.money.waivedUnused === 230 && oct(tooSoon).penalty === 30);
  const part = fig([pay(1230, "2026-10-20"), pay(100, "2026-10-25", "WV-4", "Fee/Interest Waiver")]);
  check("a partial waiver takes the penalty first, then the late fee", part.money.waivedPenalties === 30 && part.money.waivedLateFees === 70 && oct(part).lateFee === 130);
  const two = fig([pay(1230, "2026-10-20"), pay(30, "2026-10-25", "WV-5", "Fee/Interest Waiver"), pay(200, "2026-10-26", "WV-6", "Fee/Interest Waiver")]);
  check("two waivers add up", two.money.waivedTotal === 230 && oct(two).penalty === 0 && oct(two).lateFee === 0);

  // It does not count as paying on time.
  const unpaid = fig([pay(230, "2026-10-09", "Fee/Interest Waiver", "GCash")]);
  check("a loan with only a waiver is still unpaid: nothing counts as paid, and the cycle is not 'paid on time'", unpaid.paid === 0 && unpaid.built.schedule[0].paid === 0 && unpaid.built.schedule[0].status !== "PAID");
  check("the history indexes still line up with the payments list", (() => { const f = fig([pay(500, "2026-10-01"), pay(230, "2026-10-25", "WV", "Fee/Interest Waiver"), pay(700, "2026-10-30")]); return f.money.applied.map((a) => a.index).join() === "0,2" && f.money.waivers[0].index === 1; })());
  const noWaiver = E.scoreBorrower([{ ...loan, id: 1 }], new Map([[1, [pay(1230, "2026-10-20")]]]), 3);
  const withWaiver = E.scoreBorrower([{ ...loan, id: 1 }], new Map([[1, [pay(1230, "2026-10-20"), pay(230, "2026-10-25", "Fee/Interest Waiver")]]]), 3);
  check("credit score still treats the borrower as paying late (a waiver does not erase lateness)", noWaiver.score === withWaiver.score || withWaiver.score <= noWaiver.score + 8, noWaiver.score + " vs " + withWaiver.score);
})();

(async function flow() {
  const form = { name: "Glenn Avellano", email: "glenn@x.com", contact: "0917", idNum: "ID1", address: "Rizal", ccEmail: "",
    loanName: "Credit-To-Cash (80k)", loanType: "Cash Loan", principal: 1800, rate: 3, terms: 2, fee: 0, startDate: "2026-09-20", dueDay: 8, partner: "",
    totalInterest: 200, totalPayable: 2000, monthlyAmort: 1000, lateFee: 200, lateFeeFrom: "" };
  const add = await fns.addNewBorrower(form);
  const id = add.rowIndex;
  tables.loans[0].bank_monthly = 1500; tables.loans[0].bank_terms = 2; tables.loans[0].bank_fee = 0;
  await fns.recordPayment(id, "October 2026", 1230, "10/20/2026", "R1", "GCash");
  const before = sent.length;
  const r = await fns.recordPayment(id, "November 2026", 230, "10/25/2026", "", "Fee/Interest Waiver");
  check("recording a waiver succeeds and says it is a waiver", r.success && r.waiver === true && /Waiver recorded/.test(r.msg) && r.waived === 230 && r.waivedUnused === 0);
  const saved = tables.payments[tables.payments.length - 1];
  check("it is saved with a clear method and a WV- reference", saved.method === "Fee/Interest Waiver" && /^WV-/.test(saved.receipt_no));
  const mail = sent[sent.length - 1];
  check("the borrower gets a waiver notice, not an official receipt", sent.length === before + 1 && /Charges waived/.test(mail.subject) && !/Payment received/.test(mail.html) && !/Official receipt/.test(mail.html) && /not a payment/i.test(mail.html));
  check("the notice shows the amount waived and no 'payment received'", /230\.00/.test(mail.html));
  check("the returned loan shows the waiver in its history, flagged", r.detail.history.some((h) => h.waiver === true && h.waivedApplied === 230));
  check("amount paid is still just the 1,230 cash", r.detail.amountPaid === 1230);
  check("your own view carries the profit figures (admin only)", !!r.detail.profit && r.detail.profit.extrasWaived === 230);
  const borrowerView = await fns.getBorrowerData("glenn@x.com");
  check("what the borrower sees has the waiver but no profit/bank figures", JSON.stringify(borrowerView).includes('"waiver":true') && !/bankMonthly|expectedProfit|extrasWaived/.test(JSON.stringify(borrowerView)));

  // Existing data: the waiver was entered as a normal payment with the reference typed in.
  tables.payments.push({ id: 99, loan_id: id, for_month: "November 2026", amount: 219.07, paid_date: "2026-11-08", receipt_no: "Fee/Interest Waiver", method: "GCash" });
  const c = await fns.getCollectionHistory();
  check("collections count only real money (the old-style waiver and the new one are left out)", c.success && c.lifetime === 1230 && c.count === 1 && c.waivedCount === 2 && Math.abs(c.waivedTotal - 449.07) < 0.01, JSON.stringify({ l: c.lifetime, n: c.count, w: c.waivedCount }));
  check("no payment method called 'Fee/Interest Waiver' appears in the method totals", !c.methods.some((m) => /waiv/i.test(m.method)) && c.methods.length === 1);
  const rep = await fns.getAdvancedReport();
  check("the report keeps waived charges apart from collected income", rep.success && rep.income.waived >= 230 && rep.profit.collected === 1230, JSON.stringify(rep.income).slice(0, 160));
  check("...and the waived amount is not income (penalties/late fees collected are 0)", rep.income.penaltiesPaid === 0 && rep.income.lateFeesPaid === 0);
  tables.payments.pop();
  tables.payments.push({ id: 101, loan_id: id, for_month: "November 2026", amount: 500, paid_date: "2026-11-08", receipt_no: "R500", method: "GCash" },
                       { id: 102, loan_id: id, for_month: "November 2026", amount: 219.07, paid_date: "2026-11-08", receipt_no: "Fee/Interest Waiver", method: "GCash" });
  const rep2 = await fns.getAdvancedReport();
  check("report: this month's cash in counts the 500 payment and not the old-style waiver", rep2.success && JSON.stringify(rep2).includes('"cashIn":500,'), (JSON.stringify(rep2).match(/"cashIn":[0-9.]+/) || [""])[0]);
  tables.payments.splice(-2, 2);

  // Re-sending the notice for a waiver stays a notice.
  const re = await fns.sendPaymentReceipt(id, "November 2026", 230, "10/25/2026", saved.receipt_no, "Fee/Interest Waiver");
  check("re-sending a waiver sends the waiver notice again", re.success && /Charges waived/.test(sent[sent.length - 1].subject));

  console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
