import fs from 'fs/promises';
import path from 'path';
import { chromium } from '@playwright/test';

const outDir = path.resolve('docs/guides/assets');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function capture() {
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1400 },
    colorScheme: 'dark',
  });

  await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await page.screenshot({
    path: path.join(outDir, 'settings-guide-01-login.png'),
    fullPage: true,
  });

  await page.getByLabel('PROFILE').selectOption('new');
  await page.getByLabel('PROFILE NAME').fill('Guide Demo');
  await page.getByLabel('TENANT DOMAIN').fill('example.tines.com');
  await page.getByLabel('API KEY / X-USER-TOKEN').fill('sk_demo_settings_guide');
  await page.getByRole('button', { name: 'Save & Connect' }).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings' }).waitFor({ state: 'visible' });
  await page.screenshot({
    path: path.join(outDir, 'settings-guide-02-overview.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: /locked/i }).click();
  await page.screenshot({
    path: path.join(outDir, 'settings-guide-03-labs.png'),
    fullPage: true,
  });

  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
