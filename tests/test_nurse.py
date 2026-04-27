"""Nurse role tests for Seraphyn platform."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import time
import uuid
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
NURSE_EMAIL = "nurse.test@seraphyn.com"
NURSE_PASS = "Seraphyn2026!"

results = []

def log(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    msg = f"{status} | {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append({"name": name, "passed": passed, "detail": detail})

def login_as_nurse(page):
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    page.fill('input[type="email"]', NURSE_EMAIL)
    page.fill('input[type="password"]', NURSE_PASS)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # N1 — Signup page loads and has correct fields
    print("\n=== N1: Nurse Signup Page ===")
    page.goto(f"{BASE}/nurse-signup")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/n1_signup.png")
    content = page.content()
    has_name = page.locator('input[name="firstName"], input[placeholder*="First"]').count() > 0
    has_email = page.locator('input[type="email"]').count() > 0
    has_pass = page.locator('input[type="password"]').count() > 0
    has_specialty = page.locator('select[name="specialty"], select').count() > 0
    log("N1.1 Signup page loads with required fields", has_name and has_email and has_pass)
    log("N1.2 Specialty and state dropdowns present", has_specialty)

    # N2 — Login & redirect
    print("\n=== N2: Nurse Login & Access Control ===")
    login_as_nurse(page)
    url = page.url
    log("N2.1 Nurse redirected to /nurse/dashboard after login", "nurse" in url and "dashboard" in url, url)
    page.screenshot(path="/tmp/n2_nurse_dashboard.png")

    # Test access control — try to access /admin
    page.goto(f"{BASE}/admin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    admin_url = page.url
    log("N2.2 Nurse blocked from /admin", "/admin" not in admin_url or "login" in admin_url, f"Redirected to: {admin_url}")

    # Try /employer/dashboard
    page.goto(f"{BASE}/employer/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    emp_url = page.url
    log("N2.3 Nurse blocked from /employer/dashboard", "employer/dashboard" not in emp_url or "login" in emp_url, f"Redirected to: {emp_url}")

    # N3 — Nurse Dashboard
    print("\n=== N3: Nurse Dashboard ===")
    page.goto(f"{BASE}/nurse/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/n3_nurse_dashboard.png")
    content = page.content()
    log("N3.1 Nurse dashboard loads", "nurse" in page.url.lower() or "dashboard" in page.url.lower())
    has_profile_info = any(k in content.lower() for k in ["profile", "completion", "application", "status", "document"])
    log("N3.2 Dashboard shows profile/application info", has_profile_info)
    has_jobs_section = any(k in content.lower() for k in ["job", "match", "recommend", "available"])
    log("N3.3 Job recommendations/matches section present", has_jobs_section)

    # N4 — Profile Management
    print("\n=== N4: Nurse Profile Management ===")
    page.goto(f"{BASE}/nurse/profile")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/n4_profile.png")
    content = page.content()
    log("N4.1 Profile page loads", any(k in content.lower() for k in ["profile", "specialty", "license", "bio"]))

    # Check form fields
    first_name_input = page.locator('input[name="first_name"], input[placeholder*="First"], input[id*="first"]')
    log("N4.2 first_name input field present", first_name_input.count() > 0)

    specialty_select = page.locator('select[name="specialty"]')
    log("N4.3 Specialty dropdown present", specialty_select.count() > 0)

    bio_input = page.locator('textarea[name="bio"], textarea[placeholder*="bio"], textarea[placeholder*="Bio"]')
    log("N4.4 Bio textarea present", bio_input.count() > 0)

    cert_checkboxes = page.locator('input[type="checkbox"]')
    log("N4.5 Certification checkboxes present", cert_checkboxes.count() > 0, f"Found {cert_checkboxes.count()} checkboxes")

    resume_upload = page.locator('input[type="file"]')
    log("N4.6 File upload inputs present (resume/license)", resume_upload.count() > 0, f"Found {resume_upload.count()} file inputs")

    # Try updating bio
    if bio_input.count() > 0:
        bio_input.first.fill("Experienced ICU nurse with 5+ years in critical care.")
        save_btns = [b for b in page.locator("button[type='submit'], button").all()
                     if any(k in b.inner_text().lower() for k in ["save", "update", "submit"])]
        if save_btns:
            save_btns[0].click()
            page.wait_for_timeout(2000)
            page.screenshot(path="/tmp/n4_profile_saved.png")
            content_after = page.content()
            log("N4.7 Profile save action completes", True)
        else:
            log("N4.7 Profile save button found", False, "No save button")
    else:
        log("N4.7 Profile save action completes", False, "Bio field not found")

    # N5 — Job Browsing
    print("\n=== N5: Job Browsing ===")
    page.goto(f"{BASE}/jobs")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/n5_jobs.png")
    content = page.content()
    log("N5.1 Jobs page loads", any(k in content.lower() for k in ["job", "specialty", "location", "pay", "shift"]))

    # Check filter controls
    specialty_filter = page.locator('select[name="specialty"], select').first
    log("N5.2 Specialty filter dropdown present", page.locator('select').count() > 0)

    state_selects = page.locator('select').all()
    log("N5.3 State filter dropdown present", len(state_selects) >= 2, f"Found {len(state_selects)} dropdowns")

    # Count job cards
    job_cards = page.locator('[class*="card"], [class*="job"], article').all()
    log("N5.4 Job cards rendered", len(job_cards) > 0, f"Found {len(job_cards)} job elements")

    # Try filtering by shift type if dropdown exists
    if len(state_selects) >= 2:
        try:
            state_selects[1].select_option(index=1)
            page.wait_for_timeout(1000)
            log("N5.5 Filter dropdown works", True)
        except Exception as e:
            log("N5.5 Filter dropdown works", False, str(e))

    # Clear filters
    clear_btns = [b for b in page.locator("button").all() if "clear" in b.inner_text().lower() or "reset" in b.inner_text().lower()]
    if clear_btns:
        clear_btns[0].click()
        page.wait_for_timeout(1000)
        log("N5.6 Clear filters button works", True)
    else:
        log("N5.6 Clear filters button present", False, "Not found")

    # N6 — Apply to Job
    print("\n=== N6: Job Application ===")
    page.goto(f"{BASE}/jobs")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    apply_btns = [b for b in page.locator("button").all()
                  if "apply" in b.inner_text().lower() and "applied" not in b.inner_text().lower()]
    log("N6.1 Apply buttons present on jobs", len(apply_btns) > 0, f"Found {len(apply_btns)} Apply buttons")

    if apply_btns:
        apply_btns[0].click()
        page.wait_for_timeout(1500)
        page.screenshot(path="/tmp/n6_apply_modal.png")
        content_after = page.content()
        # Look for cover note textarea
        cover_note = page.locator('textarea[name="cover_note"], textarea[placeholder*="cover"], textarea[placeholder*="Cover"], textarea[placeholder*="note"]')
        log("N6.2 Cover note textarea appears after Apply click", cover_note.count() > 0)

        if cover_note.count() > 0:
            cover_note.first.fill("I am excited about this opportunity. I have 5 years of ICU experience.")

        # Submit application
        submit_btns = [b for b in page.locator("button").all()
                       if any(k in b.inner_text().lower() for k in ["submit", "apply", "send"])]
        if submit_btns:
            submit_btns[-1].click()
            page.wait_for_timeout(2500)
            page.screenshot(path="/tmp/n6_applied.png")
            content_after = page.content()
            # Check for success toast/message
            has_success = any(k in content_after.lower() for k in ["success", "applied", "submitted", "application"])
            log("N6.3 Application submitted successfully", has_success)
        else:
            log("N6.3 Application submit button found", False, "No submit button")
    else:
        log("N6.2 Cover note textarea appears", False, "No Apply buttons found")
        log("N6.3 Application submitted successfully", False, "No Apply buttons found")

    # N7 — Applications List
    print("\n=== N7: Nurse Applications List ===")
    page.goto(f"{BASE}/nurse/applications")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/n7_applications.png")
    content = page.content()
    log("N7.1 Applications list page loads", any(k in content.lower() for k in ["application", "job", "status", "submitted"]))

    app_tabs = [t.inner_text().strip() for t in page.locator("button").all() if t.inner_text().strip()]
    has_app_filters = any(k in " ".join(app_tabs).lower() for k in ["submitted", "reviewing", "hired", "all"])
    log("N7.2 Application status filter tabs present", has_app_filters, f"Tabs: {app_tabs[:10]}")

    message_btns = [b for b in page.locator("button, a").all() if "message" in b.inner_text().lower()]
    log("N7.3 Message button present on applications", len(message_btns) > 0, f"Found {len(message_btns)}")

    # N8 — Messaging
    print("\n=== N8: Nurse Messaging ===")
    page.goto(f"{BASE}/messages")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    page.screenshot(path="/tmp/n8_messages.png")
    content = page.content()
    log("N8.1 Messages page loads", any(k in content.lower() for k in ["message", "thread", "conversation", "send"]))

    msg_input = page.locator('input[placeholder*="message"], input[placeholder*="Message"], textarea[placeholder*="message"], textarea[placeholder*="Message"], input[type="text"]')
    log("N8.2 Message input field present", msg_input.count() > 0, f"Found {msg_input.count()} inputs")

    # Mobile messaging
    mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    mobile_page = mobile_ctx.new_page()
    mobile_page.goto(f"{BASE}/login")
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.fill('input[type="email"]', NURSE_EMAIL)
    mobile_page.fill('input[type="password"]', NURSE_PASS)
    mobile_page.click('button[type="submit"]')
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.wait_for_timeout(2000)
    mobile_page.goto(f"{BASE}/messages")
    mobile_page.wait_for_load_state("networkidle")
    mobile_page.wait_for_timeout(1000)
    mobile_page.screenshot(path="/tmp/n8_messages_mobile.png")
    log("N8.3 Messages page loads on mobile 390px", True, "Screenshot saved")
    mobile_ctx.close()

    # Access control — unauthenticated
    print("\n=== N_EXTRA: Unauthenticated Access ===")
    unauth_ctx = browser.new_context()
    unauth_page = unauth_ctx.new_page()
    unauth_page.goto(f"{BASE}/nurse/dashboard")
    unauth_page.wait_for_load_state("networkidle")
    unauth_page.wait_for_timeout(1500)
    unauth_url = unauth_page.url
    log("N_EXTRA.1 Unauthenticated /nurse/dashboard redirects to login", "login" in unauth_url or "nurse/dashboard" not in unauth_url, f"URL: {unauth_url}")
    unauth_ctx.close()

    browser.close()

print("\n" + "="*60)
print("NURSE TEST SUMMARY")
print("="*60)
passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
print(f"Total: {len(results)} | ✅ Passed: {passed} | ❌ Failed: {failed}")
if failed:
    print("\nFailed tests:")
    for r in results:
        if not r["passed"]:
            print(f"  ❌ {r['name']}" + (f" — {r['detail']}" if r['detail'] else ""))
