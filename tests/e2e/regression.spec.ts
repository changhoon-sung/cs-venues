import { expect, test } from "@playwright/test";

// Regression tests guarding behavioral parity with the original vanilla app.
// Each test maps to a fix made during the Preact refactor; the comment notes
// what breaks if the fix regresses.

test.describe("settings dialog", () => {
  // Bug: <dialog>.showModal() closes natively on Escape, but settingsDialog.open
  // state stayed true. Reopening the SAME mode left the effect deps unchanged,
  // so showModal() was never called again. Fixed by onCancel/onClose on <dialog>.
  test("reopens after Escape in the same mode", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !document.getElementById("summary")?.textContent?.includes("Loading"));

    const dialog = page.locator("#settingsDialog");
    const importItem = page.locator("#dataMenu button", { hasText: "Import settings" });

    await page.click("#dataMenuToggle");
    await importItem.click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Reopen the same (import) mode — the regression case.
    await page.click("#dataMenuToggle");
    await importItem.click();
    await expect(dialog).toBeVisible();
  });

  test("export then close works", async ({ page }) => {
    await page.goto("/");
    const dialog = page.locator("#settingsDialog");
    await page.click("#dataMenuToggle");
    await page.locator("#dataMenu button", { hasText: "Export settings" }).click();
    await expect(dialog).toBeVisible();
    await expect(page.locator("#settingsDialogTitle")).toHaveText("Export settings");
    await page.click("#settingsCancel");
    await expect(dialog).toBeHidden();
  });
});

test.describe("settings menu", () => {
  // The original closed the menu on Escape via a document keydown handler.
  test("closes on Escape", async ({ page }) => {
    await page.goto("/");
    const menu = page.locator("#dataMenu");
    await page.click("#dataMenuToggle");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.locator("#dataMenuToggle")).toHaveAttribute("aria-expanded", "false");
  });

  test("closes on outside click", async ({ page }) => {
    await page.goto("/");
    const menu = page.locator("#dataMenu");
    await page.click("#dataMenuToggle");
    await expect(menu).toBeVisible();
    await page.locator("h1").click();
    await expect(menu).toBeHidden();
  });
});

test.describe("favorites", () => {
  test.use({ viewport: { width: 1100, height: 800 } });

  // Toggling a favorite reorders both tables. The clicked row must stay visually
  // anchored (no scroll jump) — toggleFavoriteWithScroll compensates via scrollBy.
  test("toggle keeps the clicked row anchored and mirrors into the favorites section", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#rows [data-favorite]");
    await page.evaluate(() => window.scrollTo(0, 1200));

    const favButtons = page.locator("#rows [data-favorite]");
    const count = await favButtons.count();

    let title = "";
    let topBefore = 0;
    for (let i = 0; i < count; i++) {
      const box = await favButtons.nth(i).boundingBox();
      if (box && box.y > 100 && box.y < 600) {
        title = (await favButtons.nth(i).getAttribute("data-favorite")) ?? "";
        topBefore = box.y;
        await favButtons.nth(i).click();
        break;
      }
    }
    expect(title, "an in-view favorite button was found").not.toBe("");

    // Appears in the favorites section.
    await expect(page.locator("#favoriteVenues").locator(`[data-favorite="${cssEscape(title)}"]`)).toHaveCount(1);

    // The same row in the main table stays within a frame's worth of its prior position.
    const after = await page.locator("#rows").locator(`[data-favorite="${cssEscape(title)}"]`).first().boundingBox();
    expect(after, "row still present in main table").not.toBeNull();
    expect(Math.abs((after?.y ?? 0) - topBefore)).toBeLessThan(40);
  });
});

test.describe("venue rows", () => {
  test.use({ viewport: { width: 430, height: 800 } });

  test("renders all core=all rows immediately", async ({ page }) => {
    await page.goto("/?q=&area=all&core=all&sort=remaining&dir=asc");
    await expect(page.locator("#summary")).toContainText("Showing 349 venues");
    await expect(page.locator("#rows tr")).toHaveCount(349);
  });
});

test.describe("theme", () => {
  test.use({ colorScheme: "dark" });

  // useLayoutEffect applies data-theme before the browser paints. This guards
  // against the theme being applied after first paint (a flash). Note: in this
  // empty-shell SPA the discrimination margin is small — it mainly catches gross
  // regressions (theme not applied, applied well after paint, or wrong value).
  test("dark theme is applied at or before first paint", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __themeSetAt: number | null }).__themeSetAt = null;
      new MutationObserver(() => {
        const w = window as unknown as { __themeSetAt: number | null };
        if (w.__themeSetAt !== null) return;
        if (document.documentElement?.getAttribute("data-theme")) w.__themeSetAt = performance.now();
      }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });
    });
    await page.goto("/");
    await page.waitForFunction(() => (window as unknown as { __themeSetAt: number | null }).__themeSetAt !== null);

    const { themeSetAt, fcp, theme, bg } = await page.evaluate(() => {
      const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
      return {
        themeSetAt: (window as unknown as { __themeSetAt: number }).__themeSetAt,
        fcp: paint ? paint.startTime : null,
        theme: document.documentElement.getAttribute("data-theme"),
        bg: getComputedStyle(document.body).backgroundColor,
      };
    });

    expect(theme).toBe("dark");
    expect(bg).toBe("rgb(24, 23, 23)");
    if (fcp !== null) expect(themeSetAt).toBeLessThanOrEqual(fcp + 5);
  });

  // The ?theme= URL param must win over the system preference. The boot script
  // resolves this and readInitialUiState reads it back, so a dark-OS visitor on
  // a ?theme=light link sees light — and it survives the app's initial render
  // (no system-preference override since explicitTheme is set).
  test("?theme= URL param overrides the system preference", async ({ page }) => {
    await page.goto("/?theme=light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // Still light after the app mounts and writes its own URL/state.
    await page.waitForFunction(() => !document.getElementById("summary")?.textContent?.includes("Loading"));
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

// CSS.escape is unavailable in the Node test scope; venue titles only need quotes escaped.
function cssEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}
