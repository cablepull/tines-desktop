import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const assetsDir = path.resolve('docs/guides/assets');
const guidePath = path.resolve('docs/guides/app-user-guide.md');
const debugPort = process.env.REMOTE_DEBUG_PORT || '9223';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveScreenshot(page, filename) {
  const target = path.join(assetsDir, filename);
  await page.screenshot({ path: target, fullPage: false });
  return target;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickByText(page, text, { exact = false, timeout = 5000 } = {}) {
  const locator = exact
    ? page.getByText(text, { exact: true }).first()
    : page.getByText(text).first();
  await locator.waitFor({ state: 'visible', timeout });
  try {
    await locator.click({ timeout });
  } catch {
    await dispatchClickByText(page, text, { exact });
  }
}

async function dispatchClickByText(page, text, { exact = false } = {}) {
  const result = await page.evaluate(({ text, exact }) => {
    const nodes = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    const target = nodes.find((node) => {
      const value = (node.textContent || '').trim();
      return exact ? value === text : value.includes(text);
    });
    if (!target) return { ok: false, text };
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { ok: true, text: (target.textContent || '').trim() };
  }, { text, exact });
  if (!result?.ok) throw new Error(`Could not dispatch click for text: ${text}`);
}

async function clickChaosCard(page) {
  await page.locator('h3').filter({ hasText: /Chaos/i }).first().click();
}

async function ensureConnected(page) {
  const body = await page.locator('body').innerText();
  if (body.includes('Select a saved profile') && body.includes('Connect')) {
    await clickByText(page, 'Connect', { exact: true, timeout: 8000 });
    await page.waitForTimeout(2500);
  }
}

async function setForensicInputs(page) {
  const inputs = page.locator('input');
  await inputs.nth(0).fill('396268260');
  await inputs.nth(1).fill('9ec10c8a-7fec-44f6-aeb2-66fa01a4261e');
  await inputs.nth(2).fill('');
}

async function saveInvestigation(page) {
  await dispatchClickByText(page, '💾 Investigations');
  await page.waitForTimeout(600);

  await page.getByPlaceholder(/failure analysis/i).first().fill('Guide Demo Investigation');
  await page.locator('select').first().selectOption('needs_review');
  await page.getByPlaceholder(/Short summary/i).first().fill('Saved local investigation with story context, run scope, and downloadable artifacts.');
  await page.getByPlaceholder(/Key findings/i).first().fill('This captures notes, findings, selected run context, and evidence so you can resume later.');

  try {
    await dispatchClickByText(page, 'Save Investigation');
  } catch {
    await dispatchClickByText(page, 'Update Investigation');
  }
  await page.waitForTimeout(2500);
}

async function main() {
  await ensureDir(assetsDir);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error(`No browser context found on port ${debugPort}`);

  const pages = context.pages();
  if (!pages.length) throw new Error(`No pages found on port ${debugPort}`);

  const page = pages.find((p) => !p.url().includes('devtools://') && !p.url().includes('about:blank')) || pages[0];
  await page.bringToFront();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1500);

  await ensureConnected(page);

  await dispatchClickByText(page, 'Disconnect', { exact: true }).catch(() => {});
  await page.waitForTimeout(1200);
  await saveScreenshot(page, 'app-guide-01-connection-profile.png');
  await ensureConnected(page);

  await clickByText(page, 'Dashboard', { exact: true, timeout: 8000 });
  await page.waitForTimeout(1500);
  await saveScreenshot(page, 'app-guide-02-dashboard.png');

  await setForensicInputs(page);
  await clickByText(page, 'Lookup', { exact: true, timeout: 5000 });
  await page.waitForTimeout(3500);
  await saveScreenshot(page, 'app-guide-03-forensic-lookup.png');

  await clickByText(page, 'Dashboard', { exact: true, timeout: 8000 });
  await page.waitForTimeout(1200);
  await clickChaosCard(page);
  await page.waitForTimeout(2500);
  await clickByText(page, '⌖ Focus Canvas Over Nodes', { exact: false, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await saveScreenshot(page, 'app-guide-04-story-canvas.png');

  await dispatchClickByText(page, '✨', { exact: false });
  await page.waitForTimeout(1500);
  await saveScreenshot(page, 'app-guide-05-organize-chart.png');

  await clickByText(page, '⚠ Safety Map', { exact: false, timeout: 8000 });
  await page.waitForTimeout(1800);
  await clickByText(page, '⌖ Focus Canvas Over Nodes', { exact: false, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await saveScreenshot(page, 'app-guide-06-safety-map.png');

  await clickByText(page, '🐛 Debug Trace', { exact: false, timeout: 8000 });
  await page.waitForTimeout(4500);
  await clickByText(page, '⌖ Focus Canvas Over Nodes', { exact: false, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await saveScreenshot(page, 'app-guide-07-debug-trace.png');

  await clickByText(page, '🗄️ Story Ledger', { exact: false, timeout: 8000 });
  await page.waitForTimeout(2500);
  await saveScreenshot(page, 'app-guide-08-story-ledger.png');

  await clickByText(page, 'Visual Canvas', { exact: true, timeout: 8000 });
  await page.waitForTimeout(1500);
  await clickByText(page, '⌖ Focus Canvas Over Nodes', { exact: false, timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await saveInvestigation(page);
  await saveScreenshot(page, 'app-guide-09-save-investigation.png');

  await clickByText(page, 'Investigations', { exact: true, timeout: 8000 });
  await page.waitForTimeout(1800);
  await saveScreenshot(page, 'app-guide-10-investigations-browser.png');

  await clickByText(page, 'Editor', { exact: true, timeout: 8000 });
  await page.waitForTimeout(1800);
  await saveScreenshot(page, 'app-guide-11-editor.png');

  await clickByText(page, 'Settings', { exact: true, timeout: 8000 });
  await page.waitForTimeout(1800);
  await saveScreenshot(page, 'app-guide-12-settings.png');

  const title = await page.title().catch(() => 'tines-desktop');
  const url = page.url();

  const markdown = `# Tines Desktop User Guide

This guide was generated from the live Electron app by connecting directly to its Chrome DevTools Protocol endpoint.

## App Overview

Tines Desktop is a local desktop companion for Tines. It helps you:

- browse stories safely in a read-only workflow
- inspect execution behavior with visual and table-based debugging tools
- look up old incidents by Event ID and Story Run GUID
- save investigations locally with notes, screenshots, and evidence artifacts
- separate safe browsing from mutation-capable editing

## 1. Connection Profiles

The app opens on the **connection profile** screen. This is where you select a saved workspace profile or add a new tenant connection. For day-to-day use, this keeps Tines tenant selection local and repeatable.

![Connection profile screen](./assets/app-guide-01-connection-profile.png)

Why this matters:

- quick switching between saved environments
- local profile management for repeated use
- a safer entry point than retyping credentials each session

## 2. Dashboard

The **Dashboard** is the read-only entry point for normal story exploration. It shows the browse-first posture of the app and gives you access to story cards, forensic lookup, and the main navigation.

![Dashboard](./assets/app-guide-02-dashboard.png)

How it helps with Tines:

- review stories without mutating the tenant
- jump into investigation flows from one place
- start forensic work without digging through the web UI first

## 3. Forensic Lookup

**Forensic Lookup** is built for incident follow-up. When you have an old **Event ID** or **Story Run GUID**, it can pull story context, action context, run context, and downloadable artifacts into one place.

![Forensic Lookup](./assets/app-guide-03-forensic-lookup.png)

Use this when:

- someone gives you a historic event identifier
- you need to reconnect an old incident to a story
- you want a fast bridge from raw Tines IDs to a concrete investigation

## 4. Story Canvas

Opening a story from Dashboard lands in a read-only **Story Canvas**. The normal browse flow keeps the graph visible and interactive for investigation without exposing mutation controls.

![Story Canvas](./assets/app-guide-04-story-canvas.png)

What this gives you:

- safe canvas review
- story metadata and operational badges
- quick access to debugging and audit tools

## 5. Organize Chart

The canvas includes a local **organize chart** action through the \`✨\` auto-layout control. This rearranges nodes for easier inspection without mutating the tenant when you are in the read-only flow.

![Organize chart](./assets/app-guide-05-organize-chart.png)

Why it helps:

- makes dense graphs easier to read
- reduces overlap before debugging or export
- improves visual review without changing the server-side story

## 6. Safety Map

The **Safety Map** overlays safety classification on the graph. It is meant to help you distinguish safer nodes from more interactive or mutating ones at a glance.

![Safety Map](./assets/app-guide-06-safety-map.png)

How to read it:

- safety tiers are color-coded and summarized in the legend
- this is useful when reviewing blast radius or change risk
- it helps you reason about which nodes are safer to inspect versus which nodes deserve more caution

## 7. Debug Trace

**Debug Trace** is the visual execution view. It helps you scan recent runs, see health signals over the graph, and spot where something may be blocked or degraded.

![Debug Trace](./assets/app-guide-07-debug-trace.png)

Why it matters:

- fast triage across a whole story
- run-scoped or all-runs review
- visual identification of suspect nodes before deeper inspection

## 8. Story Audit Ledger

The **Story Audit Ledger** is the structured forensic surface. It is better than the canvas when you need exact execution rows, event IDs, run GUIDs, and impact-oriented review.

![Story Audit Ledger](./assets/app-guide-08-story-ledger.png)

Use it to:

- inspect execution evidence row by row
- compare activity across runs
- anchor debugging with concrete identifiers

## 9. Saving Investigations

Inside a story, the **Investigations** panel is focused on saving the current context. You can record status, summary, findings, selected run context, and local artifacts for later reopening.

![Save Investigation](./assets/app-guide-09-save-investigation.png)

This helps when:

- you want to pause and resume an investigation later
- you need to preserve a debugging context before switching stories
- you want a local evidence bundle with notes

## 10. Investigations Browser

Saved investigations live in their own dedicated top-level section. This is your local library for reopening, duplicating, exporting, and managing saved forensic sessions.

![Investigations browser](./assets/app-guide-10-investigations-browser.png)

Benefits:

- persistent local case history
- quick return to prior findings
- exportable local records

## 11. Editor

The **Editor** is intentionally separated from the normal dashboard workflow. It is the mutation-capable area of the app and is marked with a warning because it is still incomplete. The current safety posture of the product is that normal browsing happens in Dashboard/Story Canvas, while editing is isolated here.

![Editor](./assets/app-guide-11-editor.png)

Why the split matters:

- keeps everyday investigation safer
- makes mutation intent explicit
- avoids mixing browsing and editing concerns

Recommendation:

- do not rely on the current Editor as a primary editing workflow yet
- use it carefully and assume the safer path is still the read-only investigation flow unless you explicitly need to test editor behavior

## 12. Settings

The **Settings** page is for configuration, tenant context, and local debugger defaults. It is no longer used as a catch-all surface for editing features.

![Settings](./assets/app-guide-12-settings.png)

This area supports:

- tenant configuration
- connection-oriented settings
- local operational defaults for the rest of the app

## Recommended Workflow

1. Start in **Dashboard** for safe browsing.
2. Use **Forensic Lookup** when you already have an Event ID or Story Run GUID.
3. Open the story and inspect **Debug Trace** for visual execution context.
4. Move to **Story Audit Ledger** when you need precise evidence rows.
5. Save the session into **Investigations** if the work should persist.
6. Use **Editor** only when you intentionally want mutation-capable behavior.

## Capture Info

- Window title: \`${title}\`
- Connected URL: \`${url}\`
- Remote debug port: \`${debugPort}\`
`;

  await fs.writeFile(guidePath, markdown);
  console.log(`Wrote guide to ${guidePath}`);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
