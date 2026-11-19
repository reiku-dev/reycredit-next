/** Renelie's case: the monthly statement went out on statement day BEFORE her (on-time) November payment was
 *  logged, so it said she was overdue. The numbers were right for what the system knew. This checks that
 *  (a) the engine produces exactly that email, (b) logging the late-recorded payment warns the admin that an
 *  outdated email went out, and (c) re-sending the statement afterwards is correct. */
const Module = require("module");
const { makeFakeDb } = require("./fake-supabase.js");

const RealDate = Date;
const fixed = new RealDate("2026-11-18T01:38:00Z").getTime();   // 9:38 AM Manila on statement day
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };

const tables = {
  borrowers: [{ id: 1, name: "Renelie V", email: "r@example.com", contact: "", address: "", valid_id: "", cc_email: "" }],
  banks: [{ id: 1, name: "Bank", statement_day: 18, due_day: 8, due_month: "Next Month" }],
  loans: [{ id: 1, borrower_id: 1, loan_name: "Credit-to-Cash (70,000)", loan_type: "Cash Loan", start_date: "2026-09-18", principal: 70000, terms: 10,
    monthly_rate: 2.9, processing_fee: 0, total_interest: 21000, total_payable: 91000, monthly_amort: 9100, bank_id: 1, due_day: 8, late_fee: 300 }],
  payments: [{ id: 1, loan_id: 1, for_month: "October 2026", amount: 9800, paid_date: "2026-10-06", receipt_no: "R1", method: "Bank" }],
  users: [], email_log: [],
  config: [{ key: "PENALTY_RATE", value: "3" }, { key: "COMPANY_NAME", value: "Rey Credit" }, { key: "SUPPORT_EMAIL", value: "b@x.com" }, { key: "PORTAL_URL", value: "https://x" }],
};
const fakeDb = makeFakeDb(tables);
const sent = [];
const orig = Module._load;
Module._load = function (request) {
  if (request.endsWith("/supabase") || request === "./supabase") return { db: () => fakeDb };
  if (request.endsWith("/mailer") || request === "./mailer") return { sendMail: async (m) => { sent.push(m); return { success: true, id: "x" }; } };
  if (request.endsWith("/pdf-documents") || request === "./pdf-documents") return { renderSoaPdf: async () => Buffer.from("pdf"), renderAgreementPdf: async () => Buffer.from("pdf") };
  return orig.apply(this, arguments);
};
const fns = require("../lib/functions");

let failures = 0;
const check = (label, cond, detail) => { console.log((cond ? "PASS " : "FAIL ") + label + (cond || !detail ? "" : "  -> " + detail)); if (!cond) failures++; };

(async () => {
  // 1. Statement goes out at 9:38 AM; the November payment is not in the system yet.
  await fns.sendMonthlyStatement(1);
  const first = sent[sent.length - 1].html;
  check("statement (payment not logged yet) shows 81,773.00 outstanding", first.includes("81,773.00"));
  check("...and only October as paid", first.includes("9,800.00") && !first.includes("72,800.00"));

  // 2. Later the same day the on-time (11/07) payment is logged.
  const res = await fns.recordPayment(1, "November 2026", 8400, "11/07/2026", "BC5500003744227519", "Bank transfer");
  check("payment recorded", res.success === true, JSON.stringify(res).slice(0, 200));
  check("balance is now 72,800 with nothing overdue", res.balance === 72800 && res.detail.arrears === 0, JSON.stringify([res.balance, res.detail.arrears]));
  check("admin is warned that an outdated statement went out", !!res.staleEmail && res.staleEmail.type === "statement", JSON.stringify(res.staleEmail));
  check("the warning gives when it was sent (09:38 AM Manila)", res.staleEmail && res.staleEmail.date === "11/18/2026" && /9:38/.test(res.staleEmail.time), JSON.stringify(res.staleEmail));

  // 3. Sending the statement again is now correct.
  await fns.sendMonthlyStatement(1);
  const fixedEmail = sent[sent.length - 1].html;
  check("corrected statement shows 72,800.00 and lists the November payment", fixedEmail.includes("72,800.00") && fixedEmail.includes("November 2026") && !fixedEmail.includes("81,773.00"));

  // 4. No warning when nothing was emailed since the payment date.
  tables.email_log.length = 0;
  const res2 = await fns.recordPayment(1, "December 2026", 100, "11/18/2026", "X2", "Cash");
  check("no warning when no statement/reminder went out", res2.success && res2.staleEmail === null, JSON.stringify(res2.staleEmail));

  console.log(failures ? failures + " failed" : "all passed");
  process.exit(failures ? 1 : 0);
})();
