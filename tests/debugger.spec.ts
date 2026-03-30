import { test, expect } from '@playwright/test';

test.describe('Tines Flow Debugger UI', () => {
  test.beforeEach(async ({ page }) => {
    // The app expects tenant/apiKey in state or URL usually.
    // For now, we test that the shell loads correctly.
    await page.goto('/');
  });

  test('should render the high-level health ribbon', async ({ page }) => {
    // The ribbon is always present in StoryView
    const healthLabel = page.locator('text=HEALTH:');
    await expect(healthLabel).toBeVisible();
  });

  test('should render the debug status footer with action/event tallies', async ({ page }) => {
    // Footer is visible in debug mode
    // We might need to toggle to debug mode if it's not default
    const footer = page.locator('text=Actions:');
    await expect(footer).toBeVisible();
  });

  test('should have a functional global refresh button', async ({ page }) => {
    const refreshBtn = page.locator('button[title="Force Global Refresh"]');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    // Verify no crash after refresh
    await expect(page.locator('text=HEALTH:')).toBeVisible();
  });
});
