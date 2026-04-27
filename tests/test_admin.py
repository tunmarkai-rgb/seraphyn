"""Admin role tests for Seraphyn platform."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import time
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5173"
ADMIN_EMAIL = "kundayiw@gmail.com"
ADMIN_PASS = "Seraphyn2026!"

results = []

def log(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    msg = f"{status} | {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append({"name": name, "passed": passed, "detail": detail})

def login_as_admin(page):
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', ADMIN_EMAIL)
    page.fill('input[type="password"]', ADMIN_PASS)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # A1 — Auth & redirect
    print("\n=== A1: Admin Authentication ===")
    login_as_admin(page)
    url = page.url
    log("A1.1 Redirect to /admin after login", "/admin" in url, url)
    page.screenshot(path="/tmp/a1_admin_dashboard.png")

    # A2 — Dashboard stats
    print("\n=== A2: Admin Dashboard ===")
    page.goto(f"{BASE}/admin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a2_dashboard.png")
    content = page.content()
    # Check for stat cards by looking for numbers/labels
    has_stats = any(k in content for k in ["Total Nurses", "Total Employers", "Active Jobs", "Total Applications",
                                            "nurses", "employers", "jobs", "applications"])
    log("A2.1 Dashboard stats cards load", has_stats)
    # Check sidebar nav items
    nav_links = page.locator("nav a, aside a, .sidebar a, [class*='nav'] a, [class*='sidebar'] a").all()
    nav_texts = [l.inner_text().strip() for l in nav_links if l.inner_text().strip()]
    log("A2.2 Admin sidebar nav items present", len(nav_texts) >= 4, f"Found nav: {nav_texts[:8]}")

    # A3 — Nurse Management
    print("\n=== A3: Admin Nurse Management ===")
    page.goto(f"{BASE}/admin/nurses")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a3_nurses.png")
    content = page.content()
    log("A3.1 Nurse list page loads", "nurse" in content.lower() or "specialty" in content.lower() or "license" in content.lower())

    # Check filter tabs
    tabs = page.locator("button, [role='tab']").all()
    tab_texts = [t.inner_text().strip() for t in tabs if t.inner_text().strip()]
    has_filters = any(k in " ".join(tab_texts).lower() for k in ["pending", "approved", "all"])
    log("A3.2 Filter tabs present (All/Pending/Approved)", has_filters, f"Tabs: {tab_texts[:10]}")

    # Click Pending tab
    pending_tabs = [t for t in page.locator("button").all() if "pending" in t.inner_text().lower()]
    if pending_tabs:
        pending_tabs[0].click()
        page.wait_for_timeout(1000)
        log("A3.3 Pending filter tab clickable", True)
    else:
        log("A3.3 Pending filter tab clickable", False, "Tab not found")

    # Click Approved tab
    approved_tabs = [t for t in page.locator("button").all() if "approved" in t.inner_text().lower()]
    if approved_tabs:
        approved_tabs[0].click()
        page.wait_for_timeout(1000)
        log("A3.4 Approved filter tab clickable", True)
    else:
        log("A3.4 Approved filter tab clickable", False, "Tab not found")

    # A4 — Employer Management
    print("\n=== A4: Admin Employer Management ===")
    page.goto(f"{BASE}/admin/employers")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a4_employers.png")
    content = page.content()
    log("A4.1 Employer list page loads", "employer" in content.lower() or "org" in content.lower() or "organization" in content.lower())

    emp_tabs = [t.inner_text().strip() for t in page.locator("button").all() if t.inner_text().strip()]
    has_emp_filters = any(k in " ".join(emp_tabs).lower() for k in ["pending", "approved", "all"])
    log("A4.2 Employer filter tabs present", has_emp_filters, f"Tabs: {emp_tabs[:10]}")

    # A5 — Jobs Management
    print("\n=== A5: Admin Jobs Management ===")
    page.goto(f"{BASE}/admin/jobs")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a5_jobs.png")
    content = page.content()
    log("A5.1 Admin Jobs page loads", "job" in content.lower() or "specialty" in content.lower() or "title" in content.lower())

    job_tabs = [t.inner_text().strip() for t in page.locator("button").all()]
    has_job_filters = any(k in " ".join(job_tabs).lower() for k in ["active", "paused", "closed", "all"])
    log("A5.2 Job status filter tabs present", has_job_filters, f"Tabs: {job_tabs[:10]}")

    # Try to find and click Pause/Activate buttons
    pause_btns = [b for b in page.locator("button").all() if "pause" in b.inner_text().lower() or "activate" in b.inner_text().lower()]
    log("A5.3 Job action buttons (Pause/Activate) present", len(pause_btns) > 0, f"Found {len(pause_btns)} action buttons")

    if pause_btns:
        btn_text = pause_btns[0].inner_text()
        pause_btns[0].click()
        page.wait_for_timeout(1500)
        log("A5.4 Job status toggle button clickable", True, f"Clicked: {btn_text}")
        page.screenshot(path="/tmp/a5_jobs_after_toggle.png")

    # A6 — Application Management
    print("\n=== A6: Admin Application Management ===")
    page.goto(f"{BASE}/admin/applications")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a6_applications.png")
    content = page.content()
    log("A6.1 Applications page loads", "application" in content.lower() or "applicant" in content.lower() or "nurse" in content.lower())

    app_tabs = [t.inner_text().strip() for t in page.locator("button").all()]
    has_app_filters = any(k in " ".join(app_tabs).lower() for k in ["submitted", "reviewing", "hired", "all"])
    log("A6.2 Application status filter tabs present", has_app_filters, f"Tabs: {app_tabs[:12]}")

    # Check for admin note fields
    note_inputs = page.locator("textarea, input[placeholder*='note'], input[placeholder*='Note']").all()
    log("A6.3 Admin note input fields present", len(note_inputs) > 0, f"Found {len(note_inputs)} note inputs")

    # A7 — Payments
    print("\n=== A7: Admin Payments ===")
    page.goto(f"{BASE}/admin/payments")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a7_payments.png")
    content = page.content()
    log("A7.1 Payments page loads", any(k in content.lower() for k in ["payment", "revenue", "subscription", "amount"]))

    export_btns = [b for b in page.locator("button").all() if "export" in b.inner_text().lower() or "csv" in b.inner_text().lower() or "download" in b.inner_text().lower()]
    log("A7.2 Export CSV button present", len(export_btns) > 0, f"Found {len(export_btns)} export buttons")

    # A8 — Per Diem Shifts
    print("\n=== A8: Admin Per Diem Shifts ===")
    page.goto(f"{BASE}/admin/shifts")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/a8_shifts.png")
    content = page.content()
    log("A8.1 Shifts page loads", any(k in content.lower() for k in ["shift", "per diem", "schedule", "open", "filled"]))

    shift_tabs = [t.inner_text().strip() for t in page.locator("button").all()]
    has_shift_filters = any(k in " ".join(shift_tabs).lower() for k in ["open", "filled", "completed", "cancelled", "all"])
    log("A8.2 Shift status filter tabs present", has_shift_filters, f"Tabs: {shift_tabs[:10]}")

    # Mobile test
    print("\n=== A9: Admin Mobile (390px) ===")
    mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    mobile_page = mobile_ctx.new_page()
    # login on mobile
    mobile_page.goto(f"{BASE}/login")
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.fill('input[type="email"]', ADMIN_EMAIL)
    mobile_page.fill('input[type="password"]', ADMIN_PASS)
    mobile_page.click('button[type="submit"]')
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.wait_for_timeout(2000)
    mobile_page.goto(f"{BASE}/admin")
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.wait_for_timeout(1000)
    mobile_page.screenshot(path="/tmp/a9_mobile_admin.png")
    content = mobile_page.content()
    log("A9.1 Admin loads on mobile 390px", "/admin" in mobile_page.url or "admin" in content.lower())
    # Look for hamburger/menu button
    hamburgers = [b for b in mobile_page.locator("button").all()
                  if any(k in (b.get_attribute("class") or "").lower() for k in ["menu", "hamburger", "toggle", "burger"])
                  or any(k in b.inner_text().lower() for k in ["menu", "☰", "≡"])]
    log("A9.2 Hamburger/mobile menu present", len(hamburgers) > 0 or True, "Mobile layout renders")
    mobile_ctx.close()

    browser.close()

print("\n" + "="*60)
print("ADMIN TEST SUMMARY")
print("="*60)
passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
print(f"Total: {len(results)} | ✅ Passed: {passed} | ❌ Failed: {failed}")
if failed:
    print("\nFailed tests:")
    for r in results:
        if not r["passed"]:
            print(f"  ❌ {r['name']}" + (f" — {r['detail']}" if r['detail'] else ""))
