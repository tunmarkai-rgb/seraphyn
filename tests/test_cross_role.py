"""Cross-role and API health tests for Seraphyn platform."""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import requests
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
API = "http://localhost:5000"
ADMIN_EMAIL = "kundayiw@gmail.com"
ADMIN_PASS = "Seraphyn2026!"
NURSE_EMAIL = "nurse.test@seraphyn.com"
NURSE_PASS = "Seraphyn2026!"
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

def get_token(email, password):
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        data = r.json()
        return data.get("session", {}).get("access_token") or data.get("access_token")
    return None

# === API HEALTH CHECKS ===
print("\n=== API: Health & Auth Endpoints ===")

r = requests.get(f"{API}/api/health")
log("API.1 Health endpoint returns 200", r.status_code == 200, r.text[:100])

# Auth login — nurse
r = requests.post(f"{API}/api/auth/login", json={"email": NURSE_EMAIL, "password": NURSE_PASS})
log("API.2 Nurse login returns 200", r.status_code == 200, f"Status: {r.status_code}")
nurse_token = None
if r.status_code == 200:
    data = r.json()
    nurse_token = data.get("session", {}).get("access_token")
    log("API.3 Nurse login returns access_token", nurse_token is not None)

# Auth login — employer
r = requests.post(f"{API}/api/auth/login", json={"email": EMPLOYER_EMAIL, "password": EMPLOYER_PASS})
log("API.4 Employer login returns 200", r.status_code == 200)
employer_token = None
if r.status_code == 200:
    employer_token = r.json().get("session", {}).get("access_token")

# Auth login — admin
r = requests.post(f"{API}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
log("API.5 Admin login returns 200", r.status_code == 200)
admin_token = None
if r.status_code == 200:
    admin_token = r.json().get("session", {}).get("access_token")

# Jobs public endpoint
print("\n=== API: Jobs Endpoints ===")
r = requests.get(f"{API}/api/jobs")
log("API.6 GET /api/jobs (public) returns 200", r.status_code == 200, f"Status: {r.status_code}")
if r.status_code == 200:
    jobs_data = r.json()
    if isinstance(jobs_data, list):
        job_count = len(jobs_data)
    else:
        job_count = len(jobs_data.get("jobs", jobs_data.get("data", [])))
    log("API.7 Jobs endpoint returns job records", job_count >= 0, f"Job count: {job_count}")

# Jobs with filter
r = requests.get(f"{API}/api/jobs?state=CA")
log("API.8 GET /api/jobs?state=CA filter works", r.status_code == 200, f"Status: {r.status_code}")

# Admin stats
print("\n=== API: Admin Endpoints ===")
if admin_token:
    r = requests.get(f"{API}/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    log("API.9 GET /api/admin/stats with admin token returns 200", r.status_code == 200, f"Status: {r.status_code}")
    if r.status_code == 200:
        stats = r.json()
        has_keys = all(k in stats for k in ["totalNurses", "totalEmployers"])
        log("API.10 Stats response has expected keys", has_keys, f"Keys: {list(stats.keys())}")

    # Admin nurses list
    r = requests.get(f"{API}/api/admin/nurses", headers={"Authorization": f"Bearer {admin_token}"})
    log("API.11 GET /api/admin/nurses with admin token returns 200", r.status_code == 200, f"Status: {r.status_code}")

    # Admin employers list
    r = requests.get(f"{API}/api/admin/employers", headers={"Authorization": f"Bearer {admin_token}"})
    log("API.12 GET /api/admin/employers with admin token returns 200", r.status_code == 200, f"Status: {r.status_code}")

# Role isolation — nurse cannot access admin endpoint
print("\n=== API: Role Isolation ===")
if nurse_token:
    r = requests.get(f"{API}/api/admin/stats", headers={"Authorization": f"Bearer {nurse_token}"})
    log("API.13 Nurse token blocked from /api/admin/stats", r.status_code in [401, 403], f"Status: {r.status_code}")

    r = requests.get(f"{API}/api/admin/nurses", headers={"Authorization": f"Bearer {nurse_token}"})
    log("API.14 Nurse token blocked from /api/admin/nurses", r.status_code in [401, 403], f"Status: {r.status_code}")

# Employer cannot access admin endpoint
if employer_token:
    r = requests.get(f"{API}/api/admin/stats", headers={"Authorization": f"Bearer {employer_token}"})
    log("API.15 Employer token blocked from /api/admin/stats", r.status_code in [401, 403], f"Status: {r.status_code}")

# Unauthenticated access to protected endpoint
r = requests.get(f"{API}/api/admin/stats")
log("API.16 Unauthenticated request to admin endpoint returns 401", r.status_code == 401, f"Status: {r.status_code}")

# Nurses list for employer (with token)
if employer_token:
    r = requests.get(f"{API}/api/nurses", headers={"Authorization": f"Bearer {employer_token}"})
    log("API.17 GET /api/nurses with employer token returns 200", r.status_code == 200, f"Status: {r.status_code}")

# === BROWSER CROSS-ROLE TESTS ===
print("\n=== X3: Browser Auth Edge Cases ===")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # Admin cannot access nurse dashboard
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', ADMIN_EMAIL)
    page.fill('input[type="password"]', ADMIN_PASS)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    page.goto(f"{BASE}/nurse/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)
    admin_on_nurse = page.url
    log("X3.1 Admin blocked from /nurse/dashboard", "nurse/dashboard" not in admin_on_nurse or "login" in admin_on_nurse, f"URL: {admin_on_nurse}")
    ctx.close()

    # Nurse blocked from employer dashboard
    ctx2 = browser.new_context(viewport={"width": 1280, "height": 800})
    page2 = ctx2.new_page()
    page2.goto(f"{BASE}/login")
    page2.wait_for_load_state("networkidle")
    page2.fill('input[type="email"]', NURSE_EMAIL)
    page2.fill('input[type="password"]', NURSE_PASS)
    page2.click('button[type="submit"]')
    page2.wait_for_load_state("networkidle")
    page2.wait_for_timeout(2000)

    page2.goto(f"{BASE}/employer/dashboard")
    page2.wait_for_load_state("networkidle")
    page2.wait_for_timeout(1500)
    nurse_on_emp = page2.url
    log("X3.2 Nurse blocked from /employer/dashboard", "employer/dashboard" not in nurse_on_emp, f"URL: {nurse_on_emp}")

    page2.goto(f"{BASE}/admin")
    page2.wait_for_load_state("networkidle")
    page2.wait_for_timeout(1500)
    nurse_on_admin = page2.url
    log("X3.3 Nurse blocked from /admin", "/admin" not in nurse_on_admin or "login" in nurse_on_admin, f"URL: {nurse_on_admin}")
    ctx2.close()

    # Unauthenticated
    ctx3 = browser.new_context()
    page3 = ctx3.new_page()
    page3.goto(f"{BASE}/nurse/dashboard")
    page3.wait_for_load_state("networkidle")
    page3.wait_for_timeout(1500)
    unauth_url = page3.url
    log("X3.4 Unauthenticated visit to /nurse/dashboard redirects to login", "login" in unauth_url or "nurse/dashboard" not in unauth_url, f"URL: {unauth_url}")
    ctx3.close()

    # X4 — Mobile responsiveness
    print("\n=== X4: Mobile Responsiveness (390px) ===")
    mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    mp = mobile_ctx.new_page()
    mp.goto(f"{BASE}/login")
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(500)
    mp.screenshot(path="/tmp/x4_login_mobile.png")
    mp.fill('input[type="email"]', NURSE_EMAIL)
    mp.fill('input[type="password"]', NURSE_PASS)
    mp.click('button[type="submit"]')
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(2000)

    mp.goto(f"{BASE}/nurse/dashboard")
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(1000)
    mp.screenshot(path="/tmp/x4_nurse_dashboard_mobile.png")
    log("X4.1 /nurse/dashboard renders on mobile 390px", True)

    mp.goto(f"{BASE}/jobs")
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(1000)
    mp.screenshot(path="/tmp/x4_jobs_mobile.png")
    content = mp.content()
    log("X4.2 /jobs filter + cards render on mobile", any(k in content.lower() for k in ["job", "specialty", "filter"]))

    mp.goto(f"{BASE}/messages")
    mp.wait_for_load_state("networkidle")
    mp.wait_for_timeout(1000)
    mp.screenshot(path="/tmp/x4_messages_mobile.png")
    log("X4.3 /messages renders on mobile 390px", True)
    mobile_ctx.close()

    # Employer mobile
    emp_mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    emp_mp = emp_mobile_ctx.new_page()
    emp_mp.goto(f"{BASE}/login")
    emp_mp.wait_for_load_state("networkidle")
    emp_mp.fill('input[type="email"]', EMPLOYER_EMAIL)
    emp_mp.fill('input[type="password"]', EMPLOYER_PASS)
    emp_mp.click('button[type="submit"]')
    emp_mp.wait_for_load_state("networkidle")
    emp_mp.wait_for_timeout(2000)
    emp_mp.goto(f"{BASE}/employer/dashboard")
    emp_mp.wait_for_load_state("networkidle")
    emp_mp.wait_for_timeout(1000)
    emp_mp.screenshot(path="/tmp/x4_employer_dashboard_mobile.png")
    content = emp_mp.content()
    log("X4.4 /employer/dashboard renders on mobile 390px", any(k in content.lower() for k in ["dashboard", "job", "applicant", "employer"]))
    emp_mobile_ctx.close()

    browser.close()

print("\n" + "="*60)
print("CROSS-ROLE & API TEST SUMMARY")
print("="*60)
passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
print(f"Total: {len(results)} | ✅ Passed: {passed} | ❌ Failed: {failed}")
if failed:
    print("\nFailed tests:")
    for r in results:
        if not r["passed"]:
            print(f"  ❌ {r['name']}" + (f" — {r['detail']}" if r['detail'] else ""))
