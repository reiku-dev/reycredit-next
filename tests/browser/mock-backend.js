/**
 * A stand-in backend for the browser tests. It runs the REAL server functions (lib/functions.ts) against an
 * in-memory fake of Supabase and a mailer that sends nothing, and serves them at POST /rpc. The browser
 * tests route the app's /api/rpc calls here, so the screens are exercised against real engine output.
 *
 *   tsx tests/browser/mock-backend.js <port>
 * GET /token?role=ADMIN|BORROWER&email=... returns a session cookie value signed with SESSION_SECRET.
 */
const Module = require("module");
const http = require("http");
const path = require("path");
const bcrypt = require("bcryptjs");
const { SignJWT } = require("jose");
const { makeFakeDb } = require("../fake-supabase.js");

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "browser-test-secret-0123456789abcdef";

const tables = {
  borrowers: [
    { id: 1, name: "Maria Santos", email: "maria@example.com", contact: "0917 000 0001", address: "Quezon City", valid_id: "UMID-1234", cc_email: "" },
    { id: 2, name: "Jose Reyes", email: "jose@example.com", contact: "0918 000 0002", address: "Pasig City", valid_id: "", cc_email: "" },
    { id: 3, name: "Ana Dizon", email: "ana@example.com", contact: "", address: "", valid_id: "", cc_email: "" },
  ],
  banks: [{ id: 1, name: "Sample Bank", statement_day: 25, due_day: 8, due_month: "Next Month" }],
  loans: [
    { id: 10, borrower_id: 1, loan_name: "Credit-To-Cash (15K)", loan_type: "Cash Loan", start_date: "2026-04-29", principal: 15000, terms: 6, monthly_rate: 0.79,
      processing_fee: 300, total_interest: 711, total_payable: 16011, monthly_amort: 2618.5, bank_id: 1, due_day: 8, closed: false, late_fee: 100, late_fee_from: null,
      bank_monthly: 2700, bank_fee: 150, bank_terms: 6 },
    { id: 20, borrower_id: 2, loan_name: "Appliance Loan", loan_type: "Item Loan", start_date: "2026-07-12", principal: 12000, terms: 6, monthly_rate: 1.5,
      processing_fee: 500, total_interest: 1080, total_payable: 13580, monthly_amort: 2180, bank_id: null, due_day: 24, closed: false },
    { id: 30, borrower_id: 3, loan_name: "Emergency Cash", loan_type: "Cash Loan", start_date: "2026-01-05", principal: 3000, terms: 3, monthly_rate: 2,
      processing_fee: 0, total_interest: 180, total_payable: 3180, monthly_amort: 1060, bank_id: null, due_day: 5, closed: false },
  ],
  payments: [
    { id: 1, loan_id: 10, for_month: "June 2026", amount: 2695, paid_date: "2026-06-08", receipt_no: "R1", method: "GCash" },
    { id: 2, loan_id: 10, for_month: "July 2026", amount: 2668.5, paid_date: "2026-07-10", receipt_no: "R2", method: "GCash" },
    { id: 3, loan_id: 30, for_month: "February 2026", amount: 1060, paid_date: "2026-02-05", receipt_no: "R3", method: "Cash" },
    { id: 4, loan_id: 30, for_month: "March 2026", amount: 1060, paid_date: "2026-03-05", receipt_no: "R4", method: "Cash" },
    { id: 5, loan_id: 30, for_month: "April 2026", amount: 1060, paid_date: "2026-04-05", receipt_no: "R5", method: "Cash" },
  ],
  users: [
    { id: 1, email: "admin@example.com", password_hash: bcrypt.hashSync("admin-pass-1", 10), role: "ADMIN" },
    { id: 2, email: "maria@example.com", password_hash: bcrypt.hashSync("4821", 10), role: "BORROWER" },
  ],
  email_log: [], login_attempts: [],
  config: [
    { key: "COMPANY_NAME", value: "Rey Credit" }, { key: "PENALTY_RATE", value: "3" }, { key: "SUPPORT_EMAIL", value: "support@reycredit.test" },
    { key: "SUPPORT_PHONE", value: "0917 123 4567" }, { key: "COMPANY_ADDR", value: "Rizal, Philippines" }, { key: "LENDER_NAME", value: "Rey F. Pedrabuena" },
    { key: "PORTAL_URL", value: "https://reycredits.com" }, { key: "GCASH_ACCOUNT", value: "0917 123 4567" }, { key: "BPI_ACCOUNT", value: "1234 5678 90" },
    { key: "OFFICE_HOURS", value: "Mon - Sat, 8AM - 5PM" },
  ],
};
const fakeDb = makeFakeDb(tables);

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "./supabase" || request.endsWith("/supabase")) return { db: () => fakeDb };
  if (request === "./mailer" || request.endsWith("/mailer")) return { sendMail: async () => ({ success: true, id: "test" }) };
  if (request === "next/headers") return { cookies: () => ({ set() {}, get() { return undefined; } }) };
  if (request === "./pdf-documents" || request.endsWith("/pdf-documents")) return { renderAgreementPdf: async () => Buffer.from("pdf"), renderSoaPdf: async () => Buffer.from("pdf") };
  return origLoad.apply(this, arguments);
};

const fns = require(path.join(__dirname, "../../lib/functions.ts"));
const port = Number(process.argv[2] || 4010);
const key = new TextEncoder().encode(process.env.SESSION_SECRET);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET" && url.pathname === "/token") {
    const role = url.searchParams.get("role") || "ADMIN";
    const email = url.searchParams.get("email") || (role === "ADMIN" ? "admin@example.com" : "maria@example.com");
    const token = await new SignJWT({ email, role, sub: 1 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d").sign(key);
    return res.end(JSON.stringify({ token }));
  }
  if (req.method === "POST" && url.pathname === "/rpc") {
    let body = "";
    for await (const c of req) body += c;
    try {
      const { fn, args } = JSON.parse(body);
      if (typeof fns[fn] !== "function") { res.statusCode = 404; return res.end(JSON.stringify({ error: "Unknown function" })); }
      const result = await fns[fn](...(args || []));
      return res.end(JSON.stringify({ result: result === undefined ? null : result }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }
  res.statusCode = 404; res.end("{}");
}).listen(port, "127.0.0.1", () => console.log("mock backend on " + port));
