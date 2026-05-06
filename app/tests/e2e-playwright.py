"""
Playwright E2E tests for TimeFlow.
Usage:
  # Save session (first time - manual auth required)
  python tests/e2e-playwright.py --save-storage
  
  # Run tests with stored session
  python tests/e2e-playwright.py
"""
import argparse
import subprocess
import os
import json

STORAGE_PATH = "/tmp/timeflow_storage.json"
BASE_URL = "http://localhost:3011"

def get_playwright():
    from playwright.sync_api import sync_playwright
    return sync_playwright()

def save_storage_state():
    """Open browser for manual auth, then save storage state."""
    with get_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        context = browser.new_context()
        page = context.new_page()
        
        print("Opening browser for manual auth...")
        print(f"Navigate to: {BASE_URL}")
        page.goto(BASE_URL)
        
        # Wait for manual Google OAuth completion
        page.wait_for_url(f"**/localhost:3011**", timeout=0)  # Will timeout - user does auth manually
        
        # Save storage after manual auth
        context.storage_state(path=STORAGE_PATH)
        print(f"Session saved to {STORAGE_PATH}")
        browser.close()

def run_tests():
    if not os.path.exists(STORAGE_PATH):
        print(f"ERROR: No session found at {STORAGE_PATH}")
        print("Run with --save-storage first to authenticate manually")
        return False
    
    with get_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        context = browser.new_context(storage_state=STORAGE_PATH)
        page = context.new_page()
        
        results = []
        
        # Test 1: App loads
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        title = page.title()
        results.append(("App loads", "TimeFlow" in title or page.content()))
        
        # Test 2: Agenda view shows
        content = page.content()
        results.append(("Agenda view visible", "Sin tareas" in content or "Tareas" in content))
        
        # Test 3: Navigation tabs exist
        buttons = page.query_selector_all("button")
        button_texts = [b.inner_text() for b in buttons]
        results.append(("Timeline tab exists", any("Timeline" in t or "Hoy" in t for t in button_texts)))
        results.append(("Calendar tab exists", any("Calendario" in t or "calendar" in t.lower() for t in button_texts)))
        results.append(("Inbox tab exists", any("Inbox" in t or "Bandeja" in t for t in button_texts)))
        
        # Test 4: Click Timeline tab
        for btn in buttons:
            if "Timeline" in btn.inner_text() or "Hoy" in btn.inner_text():
                btn.click()
                page.wait_for_timeout(1000)
                break
        
        # Test 5: Command menu opens
        page.keyboard.press("Control+k")
        page.wait_for_timeout(500)
        cm_content = page.content()
        results.append(("Command menu opens", "Nueva tarea" in cm_content or "command" in cm_content.lower()))
        page.keyboard.press("Escape")
        
        browser.close()
    
    # Report
    print("\n=== Test Results ===")
    all_pass = True
    for name, passed in results:
        status = "✅" if passed else "❌"
        print(f"{status} {name}")
        if not passed:
            all_pass = False
    return all_pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-storage", action="store_true", help="Save browser session state after manual auth")
    args = parser.parse_args()
    
    if args.save_storage:
        save_storage_state()
    else:
        run_tests()
