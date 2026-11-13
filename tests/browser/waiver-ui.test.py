import threading, http.server, socketserver, functools, json
from playwright.sync_api import sync_playwright

ROOT = "/home/claude/reycredit-next/public"
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(b'{"result":null}')
httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(H, directory=ROOT)); port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
fails = 0
def check(label, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + label + ("" if cond or not detail else "  -> " + str(detail)))
    if not cond: fails += 1

MONEY = {"principalPaid":1000,"interestPaid":100,"feePaid":0,"penaltiesCharged":0,"penaltiesPaid":0,"lateFeesCharged":0,"lateFeesPaid":0,"chargesOwed":218.96,"chargesPaid":0,
  "instalmentsLeft":900,"overpaid":0,"waivedTotal":219.07,"waivedUnused":0,"applied":[],"waivers":[]}
DETAIL = {"borrowerName":"Glenn","loanName":"Credit-To-Cash (80k)","balance":14377.04,"monthlyAmort":7200,"amountPaid":14596,"money":MONEY,
  "nextBillDetails":{"month":"December 2026","bill":7200,"overdueSeparate":0,"overdueMonth":""},
  "history":[{"month":"November 2026","amount":14596,"date":"11/08/2026","receiptNo":"1631214793604","toCharges":218.96,"toInstalments":14377.04},
             {"month":"November 2026","amount":219.07,"date":"11/08/2026","receiptNo":"Fee/Interest Waiver","waiver":True,"waivedApplied":218.96,"waivedUnused":0.11,"toCharges":0,"toInstalments":0}],
  "profit":{"hasBankCost":True,"extrasWaived":219.07,"extrasCollected":0,"extrasOwed":0,"expectedProfit":1000,"netCash":0,"projectedNet":0,"collected":14596,"bankTotal":0,"bankPaid":0,"bankLeft":0,"borrowerTotal":0,"stillToCollect":0,"marginPct":0,"interestIncome":0,"feeIncome":0,"bankInterest":0,"bankFeeCharged":0,"interestMarkup":0,"principal":0,"borrowerTerms":9,"bankMonthsAfterBorrower":3,"bankMonthly":0,"bankFee":0,"bankTerms":0}}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args=["--no-sandbox"])
    page = b.new_page(viewport={"width": 1000, "height": 900}); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/index.html"); page.wait_for_timeout(300)
    page.evaluate("(d) => { window.SELECTED = d; window.SELECTED_ROW = 7; openPaymentDialog(); }", DETAIL)
    g = lambda sel: page.evaluate("(s) => document.getElementById(s).textContent", sel)
    check("normal mode: 'Record & send receipt', Method shown", "send receipt" in g("pm-save") and page.evaluate("() => document.getElementById('pm-method-wrap').style.display") == "")
    page.evaluate("() => { var c = document.getElementById('pm-waiver'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles: true})); }")
    check("waiver mode: button says Record waiver, title says Waive charges", g("pm-save") == "Record waiver" and "Waive charges" in g("pm-title"))
    check("waiver mode: amount is pre-filled with the penalty + late fees still unpaid (218.96)", page.evaluate("() => document.getElementById('pm-amount').value") == "218.96")
    check("waiver mode: Method is hidden and labels say waived / date waived", page.evaluate("() => document.getElementById('pm-method-wrap').style.display") == "none" and g("pm-amount-label") == "Amount to waive *" and g("pm-date-label") == "Date waived *")
    check("waiver mode: explains nothing is counted as received", "nothing is counted as received" in g("pm-desc"))
    page.evaluate("() => { document.getElementById('pm-date').value = '2026-11-08'; Object.defineProperty(window.google.script, 'run', { configurable: true, get: function() { var h = { withSuccessHandler: function(f){ this.ok = f; return this; }, withFailureHandler: function(){ return this; }, recordPayment: function(){ window.__args = Array.prototype.slice.call(arguments); } }; return h; } }); document.getElementById('pm-save').click(); }")
    a = page.evaluate("() => window.__args")
    check("saving sends the waiver method, the amount and the date", a and a[0] == 7 and a[2] == 218.96 and a[3] == "11/08/2026" and a[5] == "Fee/Interest Waiver", json.dumps(a))
    page.evaluate("() => { document.getElementById('pm-waiver').checked = false; document.getElementById('pm-waiver').dispatchEvent(new Event('change', {bubbles: true})); }")
    check("switching back restores the payment form", "send receipt" in g("pm-save") and page.evaluate("() => document.getElementById('pm-method-wrap').style.display") == "")
    # history and money block
    page.evaluate("(d) => { window.SELECTED = d; renderDetail(d); }", DETAIL)
    html = page.evaluate("() => document.body.textContent")
    check("the waiver shows in the history as a waiver (minus 218.96), not as a payment", "waiver" in html.lower() and "−₱218.96" in html and "not a payment" in html)
    check("'Where the payments went' lists what was waived", "Waived (forgiven, not money received)" in html and "219.07" in html)
    check("your profit shows the charges you gave up", "you waived" in html and "219.07" in html)
    check("no JavaScript errors", errs == [])
    if errs: print(errs)
    b.close()
httpd.shutdown()
print("all passed" if not fails else f"{fails} failed")
raise SystemExit(1 if fails else 0)
