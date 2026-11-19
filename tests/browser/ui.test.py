"""
Browser test for the Next.js UI. Starts the mock backend (real server functions on a fake database) and
`next start`, routes the app's /api/rpc calls to the mock, then drives the real screens in Chromium.

  npm run build && python3 tests/browser/ui.test.py [--shots DIR]
"""
import json, os, signal, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = os.environ.get("CHROME_PATH", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
APP, MOCK = 4020, 4021
SECRET = "browser-test-secret-0123456789abcdef"
SHOTS = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
if SHOTS: os.makedirs(SHOTS, exist_ok=True)

env = {**os.environ, "SESSION_SECRET": SECRET}
procs = [
    subprocess.Popen(["npx", "tsx", "tests/browser/mock-backend.js", str(MOCK)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True),
    subprocess.Popen(["npx", "next", "start", "-p", str(APP)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True),
]
def wait(url):
    for _ in range(120):
        try: urllib.request.urlopen(url, timeout=2); return
        except Exception: time.sleep(0.5)
    raise SystemExit("server did not start: " + url)

fails = 0
def check(label, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + label + ("" if cond else f"  {extra}"))
    if not cond: fails += 1

def token(role):
    return json.load(urllib.request.urlopen(f"http://127.0.0.1:{MOCK}/token?role={role}"))["token"]

try:
    wait(f"http://127.0.0.1:{MOCK}/token"); wait(f"http://127.0.0.1:{APP}/")
    admin_cookie, borrower_cookie = token("ADMIN"), token("BORROWER")
    errors = []

    def forward(route):
        req = route.request
        r = urllib.request.Request(f"http://127.0.0.1:{MOCK}/rpc", data=req.post_data.encode(), headers={"Content-Type": "application/json"}, method="POST")
        try:
            resp = urllib.request.urlopen(r); route.fulfill(status=200, content_type="application/json", body=resp.read().decode())
        except urllib.error.HTTPError as e:
            route.fulfill(status=e.code, content_type="application/json", body=e.read().decode())

    def shot(page, name):
        if SHOTS: page.screenshot(path=f"{SHOTS}/{name}.png", full_page=False)

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        def session(cookie=None, w=1366, h=860, scheme="light"):
            ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme)
            if cookie: ctx.add_cookies([{"name": "rc_session", "value": cookie, "url": f"http://127.0.0.1:{APP}"}])
            ctx.route("**/api/rpc", forward)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text and "Failed to load resource" not in m.text else None)
            return ctx, page
        base = f"http://127.0.0.1:{APP}"

        # ---- sign in ----
        ctx, page = session()
        page.goto(base + "/"); page.wait_for_selector("text=Sign in to")
        body = page.inner_text("body")
        check("sign-in page is in English", "Sign in" in body and "Forgot your password?" in body and "Mag-sign" not in body)
        shot(page, "01-sign-in")
        page.click("button:has-text('Sign in')")
        check("empty form shows validation messages", page.locator("text=Enter your email.").count() == 1 and page.locator("text=Enter your password.").count() == 1)
        page.fill("#email", "admin@example.com"); page.fill("#password", "wrong")
        page.click("button:has-text('Sign in')"); page.wait_for_selector("text=don't match")
        check("wrong password shows a friendly error", True)
        page.click("text=Forgot your password?"); page.wait_for_selector("text=Reset your password")
        page.fill("#fg-email", "maria@example.com"); page.click("button:has-text('Send PIN')"); page.wait_for_selector("text=new PIN is on its way")
        check("forgot password dialog confirms without revealing whether the account exists", True)
        ctx.close()

        # signed-out visitors are sent to sign in; wrong role is bounced
        ctx, page = session()
        page.goto(base + "/admin"); page.wait_for_selector("text=Sign in to")
        check("/admin redirects to sign-in when signed out", page.url.rstrip("/") == base)
        ctx.close()
        ctx, page = session(borrower_cookie)
        page.goto(base + "/admin"); page.wait_for_selector("text=Welcome back")
        check("a borrower cannot open /admin (sent to their portal)", page.url.endswith("/portal"))
        ctx.close()

        # ---- admin overview ----
        ctx, page = session(admin_cookie)
        page.goto(base + "/admin"); page.wait_for_selector("text=Maria Santos")
        body = page.inner_text("body")
        check("overview lists every loan", all(n in body for n in ["Maria Santos", "Jose Reyes", "Ana Dizon"]))
        check("overview shows summary stats", "Outstanding balance" in body and "Needs attention" in body)
        shot(page, "02-admin-overview")
        page.fill("[aria-label='Search loans']", "jose"); page.wait_for_timeout(200)
        check("search narrows the list", "Jose Reyes" in page.inner_text("tbody") and "Maria Santos" not in page.inner_text("tbody"))
        page.fill("[aria-label='Search loans']", "")
        shot_dark = None

        # ---- loan page ----
        page.click("tbody tr:has-text('Maria Santos') a"); page.wait_for_selector("text=Repayment progress")
        body = page.inner_text("body")
        check("loan page shows balance, paid, next payment, overdue", all(t in body for t in ["Balance owed", "Paid so far", "Next payment", "Overdue"]))
        check("your private profit is shown to the admin", "Your profit" in body and "Private" in body)
        shot(page, "03-loan-detail")
        page.click("button[role=tab]:has-text('Schedule')"); page.wait_for_selector("text=Billing schedule")
        check("schedule tab lists the cycles", "outstanding" in page.inner_text("body").lower())
        page.click("button[role=tab]:has-text('Payments')"); page.wait_for_selector("text=Payment history")
        check("payments tab lists recorded payments", "R1" in page.inner_text("body"))

        # record a payment
        page.click("button:has-text('Record payment')"); page.wait_for_selector("role=dialog")
        amount = page.input_value("#pay-amount")
        check("payment dialog is pre-filled with an amount", float(amount or 0) > 0, amount)
        shot(page, "04-record-payment")
        page.click("[role=dialog] button[role=tab]:has-text('Waive charges')")
        check("waiver mode explains it is not cash", "not</b> cash" in page.inner_html("[role=dialog]") or "is not" in page.inner_text("[role=dialog]"))
        page.click("[role=dialog] button[role=tab]:has-text('Payment')")
        page.fill("#pay-amount", "1000"); page.fill("#pay-ref", "UI-TEST-1")
        page.click("[role=dialog] button[type=submit]"); page.wait_for_selector("text=Payment recorded")
        page.wait_for_selector("[role=dialog]", state="detached")
        page.click("button[role=tab]:has-text('Payments')"); page.wait_for_selector("text=UI-TEST-1")
        check("a recorded payment appears in the history, and the dialog closed", True)

        # edit loan sheet + bank cost
        page.click("button[aria-label='More actions']"); page.click("text=Edit loan"); page.wait_for_selector("text=What the borrower will pay")
        check("edit loan shows the live total", "Total payable" in page.inner_text("[role=dialog]"))
        shot(page, "05-edit-loan")
        page.keyboard.press("Escape")
        ctx.close()

        # ---- other admin screens ----
        for path, marker, name in [("/admin/borrowers/new", "What the borrower will pay", "06-new-borrower"), ("/admin/payments", "Choose a loan", "07-payments"),
                                   ("/admin/reports", "Total receivable", "08-reports"), ("/admin/collections", "Lifetime collected", "09-collections"),
                                   ("/admin/credit", "Average score", "10-credit"), ("/admin/emails", "Email log", "11-emails"), ("/admin/settings", "Company name", "12-settings")]:
            ctx, page = session(admin_cookie)
            page.goto(base + path); page.wait_for_selector(f"text={marker}", timeout=15000)
            check(f"{path} renders", True); page.wait_for_timeout(1800); shot(page, name)
            if path == "/admin/borrowers/new":
                page.fill("#lf-principal", "10000"); page.fill("#lf-terms", "6"); page.fill("#lf-rate", "2"); page.fill("#lf-fee", "300")
                txt = page.inner_text("body")
                check("new-loan preview computes total payable (10,000 + 1,200 interest + 300 fee)", "₱11,500.00" in txt and "₱1,866.67" in txt, txt[-400:])
                page.click("button:has-text('Save borrower')")
                check("saving an empty borrower shows field errors instead of submitting", page.locator("text=Enter the borrower's full name.").count() == 1)
            if path == "/admin/reports":
                page.click("button[role=tab]:has-text('Profit')"); page.wait_for_selector("text=Where the profit comes from")
                check("profit tab is available to the admin", True)
            ctx.close()

        # ---- command palette, mobile, dark ----
        ctx, page = session(admin_cookie, 390, 800)
        page.goto(base + "/admin"); page.wait_for_selector("li:has-text('Maria Santos')")
        shot(page, "13-mobile-overview")
        page.click("button[aria-label='Open menu']"); page.wait_for_selector("[role=dialog] >> text=Admin console")
        shot(page, "14-mobile-menu"); ctx.close()
        ctx, page = session(admin_cookie, 1366, 860, "dark")
        page.goto(base + "/admin"); page.wait_for_selector("text=Maria Santos"); shot(page, "15-dark-overview")
        page.goto(base + "/admin/loans/10"); page.wait_for_selector("text=Repayment progress"); shot(page, "16-dark-loan"); ctx.close()

        # ---- borrower portal: must never show your cost or profit ----
        ctx, page = session(borrower_cookie, 430, 900)
        page.goto(base + "/portal"); page.wait_for_selector("text=Credit-To-Cash")
        body = page.inner_text("body").lower()
        check("portal shows the borrower's loan and how to pay", "how to pay" in body and "gcash" in body)
        check("portal never shows profit or bank cost", not any(w in body for w in ["profit", "bank cost", "your cost", "margin"]))
        raw = page.content().lower()
        check("...and none of it is in the page source either", "bankmonthly" not in raw and "projectednet" not in raw)
        shot(page, "17-portal"); ctx.close()

        check("no uncaught browser errors on any screen", not errors, "; ".join(errors[:5]))
        b.close()
finally:
    for pr in procs:
        try: os.killpg(pr.pid, signal.SIGTERM)   # npx starts a child; stop the whole group so no server is left running
        except ProcessLookupError: pass
print("all passed" if not fails else f"{fails} failed")
sys.exit(1 if fails else 0)
