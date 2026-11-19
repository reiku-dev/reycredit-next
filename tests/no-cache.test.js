// Regression: Next.js 14 caches server-side fetch() (even in force-dynamic GET routes),
// which froze the payments list seen by the cron and produced wrong reminder/statement emails.
// The real Supabase client must therefore always fetch with cache: "no-store".
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const seen = [];
globalThis.fetch = async (input, init) => {
  seen.push(init && init.cache);
  return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
};
process.env.SUPABASE_URL = "http://localhost:9";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

(async () => {
  const { db } = require("../lib/supabase");
  await db().from("payments").select("*").eq("loan_id", 1).order("paid_date");
  await db().from("loans").select("*");
  assert.ok(seen.length >= 2, "expected fetch calls");
  for (const c of seen) assert.strictEqual(c, "no-store", "Supabase fetch must use cache: no-store");

  for (const f of ["app/api/cron/route.ts", "app/api/rpc/route.ts"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.ok(/fetchCache\s*=\s*["']force-no-store["']/.test(src), f + " must export fetchCache = force-no-store");
  }
  console.log("no-cache: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
