"""
REAL Selenium end-to-end test of the webapp's Keycloak login + logout (FORCED login).

The app uses onLoad: "login-required", so an anonymous visit is sent STRAIGHT to the Keycloak
login page (the app is never shown). Flow tested:
  open app -> redirected to Keycloak login -> enter admin/admin -> back in app, username shown
  -> click Logout -> redirected to Keycloak login again (forced).

Runs HEADED (visible browser) by default; set HEADLESS=1 to hide it.
Prereqs running: Vite dev server on :5173 and Keycloak on :8081 with the `aisc` realm.

Run:
  pip install selenium
  python apps/webapp/e2e/test_login_logout_selenium.py
"""
import os
import sys

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WEBAPP = "http://localhost:5173/"


def make_driver():
    opts = Options()
    if os.environ.get("HEADLESS") == "1":
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,900")
    return webdriver.Chrome(options=opts)


def at_keycloak_login(driver, wait):
    """Wait until the Keycloak login form (username field) is present."""
    wait.until(EC.presence_of_element_located((By.ID, "username")))
    assert "/realms/aisc/" in driver.current_url, f"expected Keycloak login, got {driver.current_url}"


def main() -> int:
    driver = make_driver()
    wait = WebDriverWait(driver, 25)
    try:
        # 1) open the app -> FORCED straight to Keycloak login (app never shown)
        driver.get(WEBAPP)
        at_keycloak_login(driver, wait)
        print("1) anonymous visit redirected to Keycloak login (forced)")

        # 2) enter credentials
        driver.find_element(By.ID, "username").send_keys("admin")
        driver.find_element(By.ID, "password").send_keys("admin")
        driver.find_element(By.ID, "kc-login").click()
        print("2) submitted Keycloak login")

        # 3) back in the app -> username 'admin' shown
        username_el = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="auth-username"]')))
        assert username_el.text.strip() == "admin", f"expected 'admin', got '{username_el.text}'"
        print("3) logged in as:", username_el.text)

        # 4) logout -> forced back to the Keycloak login page
        driver.find_element(By.CSS_SELECTOR, '[data-testid="logout-button"]').click()
        at_keycloak_login(driver, wait)
        print("4) logged out -> back at Keycloak login (forced)")

        print("\nPASS: forced login + logout work end-to-end.")
        return 0
    except Exception as e:
        print("\nFAIL:", type(e).__name__, e)
        driver.save_screenshot("/tmp/selenium-failure.png")
        print("screenshot: /tmp/selenium-failure.png")
        return 1
    finally:
        driver.quit()


if __name__ == "__main__":
    raise SystemExit(main())
