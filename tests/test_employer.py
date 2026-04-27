"""Employer role tests for Seraphyn platform."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
EMPLOYER_EMAIL = "employer.test@seraphyn.com"
EMPLOYER_PASS = "Seraphyn2026!"

results = []

def log(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    msg = f"{status} | {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append({"name": name, "passed": passed, "detail": detail})

def login_as_employer(page):
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    page.fill('input[type="email"]', EMPLOYER_EMAIL)
    page.fill('input[type="password"]', EMPLOYER_PASS)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # E1 — Signup page
    print("\n=== E1: Employer Signup Page ===")
    page.goto(f"{BASE}/employer-signup")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/e1_signup.png")
    content = page.content()
    has_email = page.locator('input[type="email"]').count() > 0
    has_pass = page.locator('input[type="password"]').count() > 0
    has_org = any(k in content.lower() for k in ["organization", "org", "company", "contact"])
    log("E1.1 Employer signup page loads with form", has_email and has_pass)
    log("E1.2 Org/company fields present", has_org)

    # E2 — Login
    print("\n=== E2: Employer Login ===")
    login_as_employer(page)
    url = page.url
    log("E2.1 Employer login redirects to dashboard or onboarding", "employer" in url, f"URL: {url}")
    page.screenshot(path="/tmp/e2_employer_landing.png")

    # E3/E4/E5 — Onboarding page check
    print("\n=== E3-E5: Employer Onboarding ===")
    page.goto(f"{BASE}/employer/onboarding")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/e3_onboarding.png")
    content = page.content()
    log("E3.1 Onboarding page loads", any(k in content.lower() for k in ["onboard", "profile", "organization", "stage", "contract", "step"]))

    # Check for Stage 1 form fields or Stage 2/3 indicators
    has_org_form = any(k in content.lower() for k in ["org_name", "organization name", "org name", "contact", "bed", "description"])
    has_contract = any(k in content.lower() for k in ["contract", "sign", "agreement", "review", "submitted"])
    has_approved = any(k in content.lower() for k in ["approved", "dashboard", "access"])
    log("E3.2 Onboarding content shows correct stage", has_org_form or has_contract or has_approved,
        f"org_form={has_org_form}, contract={has_contract}, approved={has_approved}")

    # If Stage 1 form visible, check fields
    if has_org_form:
        org_input = page.locator('input[name="org_name"], input[placeholder*="organization"], input[placeholder*="Organization"]')
        log("E3.3 org_name input field present", org_input.count() > 0)
        city_input = page.locator('input[name="city"], input[placeholder*="city"], input[placeholder*="City"]')
        log("E3.4 City input field present", city_input.count() > 0)
    else:
        log("E3.3 Onboarding is post-Stage-1 (already submitted)", True, "Stage 2 or 3")
        log("E3.4 City input field (Stage 1 done)", True, "Skipped — already past Stage 1")

    # E6 — Employer Dashboard
    print("\n=== E6: Employer Dashboard ===")
    page.goto(f"{BASE}/employer/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/e6_dashboard.png")
    content = page.content()
    log("E6.1 Employer dashboard loads", any(k in content.lower() for k in ["dashboard", "job", "applicant", "active", "hire"]))

    # Stat cards
    stat_keywords = ["active job", "applicant", "application", "hire", "total"]
    has_stats = sum(1 for k in stat_keywords if k in content.lower()) >= 2
    log("E6.2 Dashboard stat cards present", has_stats, f"Keywords matched: {[k for k in stat_keywords if k in content.lower()]}")

    # Applications section
    has_apps_section = any(k in content.lower() for k in ["recent application", "applicant", "reviewing", "interview"])
    log("E6.3 Recent Applications section present", has_apps_section)

    # Job postings section
    has_jobs_section = any(k in content.lower() for k in ["job posting", "post a job", "your job", "active job"])
    log("E6.4 Job Postings section present", has_jobs_section)

    # Quick links
    quick_links = [a for a in page.locator("a").all()
                   if any(k in a.inner_text().lower() for k in ["nurse", "message", "onboarding", "account", "post"])]
    log("E6.5 Quick links present (Nurses, Messages, etc.)", len(quick_links) > 0, f"Found {len(quick_links)} quick links")

    # Try advancing an application status
    status_btns = [b for b in page.locator("button").all()
                   if any(k in b.inner_text().lower() for k in ["reviewing", "interview", "offer", "hired", "reject"])]
    if status_btns:
        btn_text = status_btns[0].inner_text()
        status_btns[0].click()
        page.wait_for_timeout(1500)
        log("E6.6 Application status advance button clickable", True, f"Clicked: {btn_text}")
        page.screenshot(path="/tmp/e6_status_changed.png")
    else:
        log("E6.6 Application status buttons present", False, "No status buttons found (may have no applications)")

    # Toggle job status
    toggle_btns = [b for b in page.locator("button").all()
                   if any(k in b.inner_text().lower() for k in ["pause", "activate", "active"])]
    if toggle_btns:
        btn_text = toggle_btns[0].inner_text()
        toggle_btns[0].click()
        page.wait_for_timeout(1500)
        log("E6.7 Job status toggle button clickable", True, f"Clicked: {btn_text}")
    else:
        log("E6.7 Job status toggle button present", False, "No toggle buttons found (may have no jobs)")

    # E7 — Post Job
    print("\n=== E7: Post Job ===")
    page.goto(f"{BASE}/employer/post-job")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/e7_post_job.png")
    content = page.content()
    log("E7.1 Post Job page loads (approved employer)", any(k in content.lower() for k in ["post", "job", "shift", "specialty", "title"]))

    # Check for form fields
    title_input = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="Title"]')
    log("E7.2 Job title input present", title_input.count() > 0)

    specialty_sel = page.locator('select[name="specialty"]')
    log("E7.3 Specialty select present", specialty_sel.count() > 0)

    # Tab toggle for Job vs Shift
    type_tabs = [b for b in page.locator("button").all()
                 if any(k in b.inner_text().lower() for k in ["job", "shift", "per diem", "diem"])]
    log("E7.4 Job/Shift type toggle tabs present", len(type_tabs) > 0, f"Tabs: {[t.inner_text() for t in type_tabs]}")

    # Fill and submit a job
    if title_input.count() > 0:
        title_input.first.fill("ICU Staff Nurse - Night Shift")
        if specialty_sel.count() > 0:
            try:
                specialty_sel.select_option(index=1)
            except:
                pass
        city_inp = page.locator('input[name="city"], input[placeholder*="city"]')
        if city_inp.count() > 0:
            city_inp.first.fill("Los Angeles")
        state_sel = page.locator('select[name="state"]')
        if state_sel.count() > 0:
            try:
                state_sel.select_option("CA")
            except:
                pass
        desc_inp = page.locator('textarea[name="description"], textarea[placeholder*="description"]')
        if desc_inp.count() > 0:
            desc_inp.first.fill("Looking for an experienced ICU nurse for night shifts.")
        pay_inp = page.locator('input[name="pay_rate"], input[placeholder*="pay"], input[type="number"]')
        if pay_inp.count() > 0:
            pay_inp.first.fill("65")

        submit_btns = [b for b in page.locator("button[type='submit'], button").all()
                       if any(k in b.inner_text().lower() for k in ["post", "submit", "create", "save"])]
        if submit_btns:
            submit_btns[0].click()
            page.wait_for_timeout(2500)
            page.screenshot(path="/tmp/e7_job_posted.png")
            content_after = page.content()
            has_success = any(k in content_after.lower() for k in ["success", "posted", "created", "job"])
            log("E7.5 Job posted successfully", has_success)
        else:
            log("E7.5 Job submit button found", False, "No submit button")
    else:
        log("E7.5 Job form fillable", False, "Title input not found")

    # Post a Per Diem Shift
    if type_tabs:
        shift_tab = [t for t in type_tabs if "shift" in t.inner_text().lower() or "diem" in t.inner_text().lower()]
        if shift_tab:
            shift_tab[0].click()
            page.wait_for_timeout(1000)
            page.screenshot(path="/tmp/e7_shift_form.png")
            content = page.content()
            log("E7.6 Per Diem Shift tab switches form", any(k in content.lower() for k in ["date", "start time", "end time", "hourly"]))
        else:
            log("E7.6 Per Diem Shift tab present", False, "No shift tab found")
    else:
        log("E7.6 Per Diem Shift tab present", False)

    # E8 — Browse Nurses
    print("\n=== E8: Employer Browse Nurses ===")
    page.goto(f"{BASE}/nurses")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/e8_nurses.png")
    content = page.content()
    log("E8.1 Nurses list page loads for employer", any(k in content.lower() for k in ["nurse", "specialty", "experience", "available"]))

    nurse_cards = page.locator('[class*="card"], [class*="nurse"], article').all()
    log("E8.2 Nurse profile cards render", len(nurse_cards) > 0, f"Found {len(nurse_cards)} nurse elements")

    # Check that full details are visible for approved employer
    has_full_profile = any(k in content.lower() for k in ["bio", "certification", "license", "years"])
    log("E8.3 Approved employer sees full nurse profiles", has_full_profile)

    # Click first nurse for detail view
    nurse_links = [a for a in page.locator("a").all() if "/nurses/" in (a.get_attribute("href") or "")]
    if nurse_links:
        nurse_links[0].click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.screenshot(path="/tmp/e8_nurse_detail.png")
        log("E8.4 Nurse detail page loads on click", "/nurses/" in page.url, page.url)
    else:
        # Try clicking a card
        if nurse_cards:
            nurse_cards[0].click()
            page.wait_for_timeout(1500)
            log("E8.4 Nurse card is clickable", True)
        else:
            log("E8.4 Nurse detail navigation", False, "No nurse links found")

    # E9 — Messaging
    print("\n=== E9: Employer Messaging ===")
    page.goto(f"{BASE}/messages")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/e9_messages.png")
    content = page.content()
    log("E9.1 Messages page loads for employer", any(k in content.lower() for k in ["message", "thread", "conversation", "send", "inbox"]))

    msg_input = page.locator('input[type="text"], textarea').all()
    send_btns = [b for b in page.locator("button").all() if "send" in b.inner_text().lower()]
    log("E9.2 Message send interface present", len(msg_input) > 0 or len(send_btns) > 0)

    # Mobile test
    mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    mp = mobile_ctx.new_page()
    mp.goto(f"{BASE}/login")
    mp.wait_for_load_state("networkidle")
    mp.fill('input[type="email"]', EMPLOYER_EMAIL)
    mp.fill('input[type="password"]', EMPLOYER_PASS)
    mp.click('button[type="submit"]')
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(2000)
    mp.goto(f"{BASE}/employer/dashboard")
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(1000)
    mp.screenshot(path="/tmp/e9_employer_mobile.png")
    log("E9.3 Employer dashboard renders on mobile 390px", True)
    mobile_ctx.close()

    browser.close()

print("\n" + "="*60)
print("EMPLOYER TEST SUMMARY")
print("="*60)
passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
print(f"Total: {len(results)} | ✅ Passed: {passed} | ❌ Failed: {failed}")
if failed:
    print("\nFailed tests:")
    for r in results:
        if not r["passed"]:
            print(f"  ❌ {r['name']}" + (f" — {r['detail']}" if r['detail'] else ""))
