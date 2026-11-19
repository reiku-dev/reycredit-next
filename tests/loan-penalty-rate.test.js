/**
 * Per-loan penalty rate: a loan whose agreement says 5% per month is charged 5% even though the
 * company default is 3%, and a loan with no rate of its own still follows the default.
 * Numbers use the co-borrower example: BPI share P4,841.71 a month, due on the 10th, no late fee.
 */
const { buildSchedule, balanceFrom } = require("../lib/engine");

const RealDate = Date;
function setToday(iso) {
  const fixed = new RealDate(iso + "T04:00:00Z").getTime();
  global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
}
const D = (s) => new RealDate(s);
let failures = 0;
const check = (label, cond, detail) => { console.log((cond ? "PASS " : "FAIL ") + label + (cond || !detail ? "" : "  -> " + detail)); if (!cond) failures++; };

const loan = (extra) => ({ id: 7, startDate: D("2026-02-10"), totalPayable: 58100.52, terms: 12, monthlyAmort: 4841.71, processingFee: 0, bank: null, dueDay: 10, loanName: "Shared BPI loan", lateFee: 0, ...extra });
const months = ["February", "March", "April", "May", "June", "July", "August", "September", "October"];
const onTime = months.map((m, i) => ({ month: m + " 2026", amount: 4841.71, date: D(`2026-${String(i + 2).padStart(2, "0")}-09`) }));

setToday("2026-11-19");   // November 10 is nine days past due and unpaid

const nov = (b) => b.schedule.find((r) => /November/.test(r.month || r.label || ""));
{
  const b = buildSchedule(loan({ penaltyRate: 5 }), onTime, 3);
  const r = nov(b);
  check("5% on the loan: November penalty is 242.09 (4,841.71 x 5%)", r && r.penalty === 242.09, JSON.stringify(r && r.penalty));
  check("...no late fee", r && r.lateFee === 0, JSON.stringify(r && r.lateFee));
  check("...so November is 5,083.80 to pay", balanceFrom(b.schedule.filter((x) => /(February|March|April|May|June|July|August|September|October|November)/.test(x.month || x.label || ""))) === 5083.8, String(balanceFrom(b.schedule.filter((x) => /(February|March|April|May|June|July|August|September|October|November)/.test(x.month || x.label || "")))));
}
{
  const b = buildSchedule(loan({}), onTime, 3);
  check("no rate on the loan: follows the company 3% (145.25)", nov(b).penalty === 145.25, String(nov(b).penalty));
}
{
  const b = buildSchedule(loan({ penaltyRate: null }), onTime, 3);
  check("null rate = company default", nov(b).penalty === 145.25, String(nov(b).penalty));
}
{
  const b = buildSchedule(loan({ penaltyRate: 0 }), onTime, 3);
  check("a rate of 0 means no penalty (not 'use the default')", nov(b).penalty === 0, String(nov(b).penalty));
}
{
  const b = buildSchedule(loan({ penaltyRate: 5 }), onTime, 3);
  const early = b.schedule.find((r) => /February/.test(r.month || r.label || ""));
  check("paid-on-time months have no penalty either way", early.penalty === 0);
}

// ---- Agreement rule: "X% per month on the unpaid amount" for a loan with its own rate ----
const penOf = (b, m) => b.schedule.find((r) => (r.month || r.label || "").startsWith(m)).penalty;
const own = (extra) => loan({ penaltyRate: 5, ...extra });
{
  setToday("2026-12-11");   // November and December are both unpaid
  const b = buildSchedule(own(), onTime, 3);
  check("Nov unpaid: 242.09", penOf(b, "November") === 242.09, String(penOf(b, "November")));
  check("Dec: 5% of the TWO instalments still unpaid (9,683.42) = 484.17, no penalty on the Nov penalty", penOf(b, "December") === 484.17, String(penOf(b, "December")));
  const d = buildSchedule(loan({}), onTime, 3);
  check("company-default loan keeps the full-bill rule (3% of 4,841.71 + 4,841.71 + 145.25 = 9,828.67 -> 294.86)", penOf(d, "December") === 294.86, String(penOf(d, "December")));
}
{
  setToday("2026-12-11");   // November paid in full (with its penalty) on 11/20, December part-paid early
  const pays = [...onTime,
    { month: "November 2026", amount: 5083.8, date: D("2026-11-20") },
    { month: "December 2026", amount: 2000, date: D("2026-12-05") }];
  const b = buildSchedule(own(), pays, 3);
  check("part paid before the due date: penalty only on the unpaid part (2,841.71 x 5% = 142.09)", penOf(b, "December") === 142.09, String(penOf(b, "December")));
  const d = buildSchedule(loan({}), pays, 3);
  check("company-default loan still charges the FULL bill (145.25)", penOf(d, "December") === 145.25, String(penOf(d, "December")));
}
{
  setToday("2026-12-11");   // November paid late with its penalty, December paid on time
  const pays = [...onTime,
    { month: "November 2026", amount: 5083.8, date: D("2026-11-20") },
    { month: "December 2026", amount: 4841.71, date: D("2026-12-09") }];
  const b = buildSchedule(own(), pays, 3);
  check("late Nov stays 242.09, and December paid on time has no penalty", penOf(b, "November") === 242.09 && penOf(b, "December") === 0, JSON.stringify([penOf(b, "November"), penOf(b, "December")]));
  check("nothing owed once Nov (5,083.80) and Dec (4,841.71) are paid", balanceFrom(b.schedule.filter((x) => /(February|March|April|May|June|July|August|September|October|November|December)/.test(x.month))) === 0);
}
{
  setToday("2026-11-19");   // the lender waives the November penalty
  const pays = [...onTime, { month: "November 2026", amount: 242.09, date: D("2026-11-19"), method: "Fee/Interest Waiver" }];
  const b = buildSchedule(own(), pays, 3);
  check("a waiver of 242.09 removes the November penalty", penOf(b, "November") === 0, String(penOf(b, "November")));
}
{
  setToday("2026-11-19");   // a part payment on the due date: only the rest is penalised
  const pays = [...onTime, { month: "November 2026", amount: 1841.71, date: D("2026-11-10") }];
  const b = buildSchedule(own(), pays, 3);
  check("1,841.71 paid on the due date: 5% of the unpaid 3,000 = 150", penOf(b, "November") === 150, String(penOf(b, "November")));
}

global.Date = RealDate;
if (failures) { console.log(failures + " FAILED"); process.exit(1); }
console.log("all passed");
