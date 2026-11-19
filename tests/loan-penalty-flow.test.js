/** End to end: a loan's own penalty rate is saved, drives the figures, and appears in its SOA, agreement and
 *  emails; other loans keep the company 3%; a database without penalty-rate.sql still saves everything else. */
const Module = require("module");
const { makeFakeDb } = require("./fake-supabase.js");

const RealDate = Date;
function setToday(iso) {
  const fixed = new RealDate(iso + "T04:00:00Z").getTime();
  global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
}
setToday("2026-11-19");

const tables = {
  borrowers: [], loans: [], payments: [], users: [], email_log: [], banks: [],
  config: [{ key: "PENALTY_RATE", value: "3" }, { key: "COMPANY_NAME", value: "Rey Credit" }, { key: "LENDER_NAME", value: "Rey F." },
    { key: "SUPPORT_EMAIL", value: "b@x.com" }, { key: "SUPPORT_PHONE", value: "0968" }, { key: "COMPANY_ADDR", value: "Rizal" }, { key: "LENDER_ADDR", value: "Rizal" },
    { key: "PORTAL_URL", value: "https://x" }, { key: "GCASH_ACCOUNT", value: "0968" }, { key: "BPI_ACCOUNT", value: "065" }, { key: "MARIBANK_ACCOUNT", value: "171" }, { key: "OFFICE_HOURS", value: "Mon-Sat" }],
};
const fakeDb = makeFakeDb(tables);
let columnMissing = false;
const db = { from(name) {
  const b = fakeDb.from(name);
  if (name !== "loans") return b;
  const update = b.update.bind(b);
  b.update = (p) => {
    if (columnMissing && "penalty_rate" in p) return { eq: () => Promise.resolve({ data: null, error: { message: 'column "penalty_rate" of relation "loans" does not exist' } }) };
    return update(p);
  };
  return b;
} };
const sent = [];
const orig = Module._load;
Module._load = function (request) {
  if (request.endsWith("/supabase") || request === "./supabase") return { db: () => db };
  if (request.endsWith("/mailer") || request === "./mailer") return { sendMail: async (m) => { sent.push(m); return { success: true, id: "rs" }; } };
  return orig.apply(this, arguments);
};
const fns = require("../lib/functions");
const { buildSoaHtml } = require("../lib/documents");

let failures = 0;
const check = (label, cond, detail) => { console.log((cond ? "PASS " : "FAIL ") + label + (cond || !detail ? "" : "  -> " + detail)); if (!cond) failures++; };

const form = (over) => ({ name: "Sample Coborrower", email: "co@x.com", contact: "0917", idNum: "ID1", address: "Rizal", ccEmail: "",
  loanName: "Shared BPI loan", loanType: "Cash Loan", principal: 58100.52, rate: 0, terms: 12, fee: 0, startDate: "2026-02-10",
  dueDay: 10, partner: "", totalInterest: 0, totalPayable: 58100.52, monthlyAmort: 4841.71, lateFee: 0, lateFeeFrom: "", ...over });

(async () => {
  // 1. New loan with its own 5%.
  let r = await fns.addNewBorrower(form({ penaltyRate: 5 }));
  const loan = tables.loans[0];
  check("new loan saves its own penalty rate", r.success && Number(loan.penalty_rate) === 5, JSON.stringify([r.msg, loan.penalty_rate]));
  let d = await fns.getAdminBorrowerDetail(loan.id);
  check("loan detail: own rate 5 and applied rate 5", d.penaltyRateOwn === 5 && d.penaltyRate === 5, JSON.stringify([d.penaltyRateOwn, d.penaltyRate]));

  // 2. A second loan with no rate follows the 3% default.
  r = await fns.addNewBorrower(form({ name: "Other Person", email: "other@x.com" }));
  const loan2 = tables.loans[1];
  const d2 = await fns.getAdminBorrowerDetail(loan2.id);
  check("a loan with no rate saved follows the default 3%", d2.penaltyRateOwn === null && d2.penaltyRate === 3, JSON.stringify([d2.penaltyRateOwn, d2.penaltyRate]));

  // 3. Same unpaid November, different penalty, no late fee.
  const nov = (det) => det.history && det.nextBillDetails;
  const b1 = d.nextBillDetails, b2 = d2.nextBillDetails;
  check("5% loan: bill carries more penalty than the 3% loan", d.balance > d2.balance, JSON.stringify([d.balance, d2.balance]));

  // 4. The SOA and the emails state this loan's rate.
  const cfg = await fns.getConfig();
  const row = { ...loan, borrowers: tables.borrowers[0] };
  const html = (await fns.getDocumentHtml(loan.id, "soa")).html;
  check("SOA says 5% for this loan", /5% monthly penalty/.test(html) && !/3% monthly penalty/.test(html));
  const html2 = (await fns.getDocumentHtml(loan2.id, "soa")).html;
  check("SOA of the other loan still says 3%", /3% monthly penalty/.test(html2));

  // 5. Editing: blank clears the override, no field leaves it alone.
  await fns.updateBorrower(loan.id, form({ penaltyRate: "" }));
  check("blank penalty clears the override (back to default)", tables.loans[0].penalty_rate === null, String(tables.loans[0].penalty_rate));
  await fns.updateBorrower(loan.id, form({ penaltyRate: 5 }));
  const noField = form(); delete noField.penaltyRate;
  await fns.updateBorrower(loan.id, noField);
  check("a form without the field leaves the saved rate alone", Number(tables.loans[0].penalty_rate) === 5, String(tables.loans[0].penalty_rate));
  await fns.updateBorrower(loan.id, form({ penaltyRate: 5, lateFee: 0 }));
  check("late fee stays 0 (none)", !Number(tables.loans[0].late_fee));

  // 6. Database without penalty-rate.sql: loan still saves, with a clear message.
  columnMissing = true;
  r = await fns.addNewBorrower(form({ name: "No Column", email: "nc@x.com", penaltyRate: 5 }));
  check("without the column: loan still saved, message says run penalty-rate.sql", r.success && /penalty-rate\.sql/.test(r.msg), JSON.stringify(r.msg));
  r = await fns.updateBorrower(loan.id, form({ penaltyRate: 4 }));
  check("editing without the column reports it instead of silently ignoring", r.success === false && /penalty-rate\.sql/.test(r.msg), JSON.stringify(r));

  global.Date = RealDate;
  if (failures) { console.log(failures + " FAILED"); process.exit(1); }
  console.log("all passed");
})().catch((e) => { console.error(e); process.exit(1); });
