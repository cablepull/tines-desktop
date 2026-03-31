import fs from 'fs/promises';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const assetsDir = path.resolve('docs/guides/assets');
const guidePath = path.resolve('docs/guides/app-user-guide.md');

function getTextContent(result) {
  return (result.content || [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function getImageContent(result) {
  return (result.content || []).find((item) => item.type === 'image');
}

function unwrapResult(text) {
  let value = text.trim();
  const prefixes = ['✅ Result:', '✅ Command executed:', '✅ Command successful:'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (value.startsWith(prefix)) {
        value = value.slice(prefix.length).trim();
        changed = true;
      }
    }
  }
  return value;
}

function parseMaybeJson(text) {
  const trimmed = unwrapResult(text);
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && 'result' in parsed) {
      return typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
    }
    return parsed;
  } catch {
    return trimmed;
  }
}

async function saveScreenshot(result, filename) {
  const image = getImageContent(result);
  if (!image?.data) {
    throw new Error(`Missing screenshot image payload for ${filename}`);
  }
  const target = path.join(assetsDir, filename);
  await fs.writeFile(target, Buffer.from(image.data, 'base64'));
  return target;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await fs.mkdir(assetsDir, { recursive: true });

  const client = new Client(
    { name: 'app-user-guide-capture', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'mcp:start'],
    cwd: process.cwd(),
    env: { ...process.env, SECURITY_LEVEL: 'balanced' },
  });

  const tool = async (command, args = {}) => {
    const result = await client.callTool({
      name: 'send_command_to_electron',
      arguments: { command, args },
    });
    return unwrapResult(getTextContent(result));
  };

  const evalJson = async (code) => parseMaybeJson(await tool('eval', { code }));

  const setInputByPlaceholder = async (placeholder, value) => {
    await tool('fill_input', { placeholder, value });
  };

  const clickButtonContaining = async (text) => {
    return evalJson(`
      (() => {
        const button = Array.from(document.getElementsByTagName('button'))
          .find((candidate) => (candidate.textContent || '').includes(${JSON.stringify(text)}));
        if (!button) return { ok: false, text: ${JSON.stringify(text)} };
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { ok: true, text: (button.textContent || '').trim() };
      })()
    `);
  };

  const clickSidebar = async (text) => {
    await tool('click_by_text', { text });
  };

  const clickChaosStoryCard = async () => {
    return evalJson(`
      (() => {
        const headers = Array.from(document.getElementsByTagName('h3'));
        const node = headers.find((h) => /Chaos/i.test(h.textContent || ''));
        const card = node ? node.closest('div.glass-panel') : null;
        if (!card) return { ok: false };
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { ok: true, title: (node.textContent || '').trim() };
      })()
    `);
  };

  const screenshot = async (filename) => {
    const result = await client.callTool({ name: 'take_screenshot', arguments: {} });
    await saveScreenshot(result, filename);
  };

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = (tools.tools || []).map((tool) => tool.name);
    const windowInfo = await client.callTool({ name: 'get_electron_window_info', arguments: {} });

    const initialBody = await tool('get_body_text');
    if (initialBody.includes('Select a saved profile') && initialBody.includes('Connect')) {
      await tool('click_by_text', { text: 'Connect' });
      await sleep(2500);
    }

    await clickSidebar('Dashboard');
    await sleep(1500);
    await screenshot('app-guide-01-dashboard.png');

    await setInputByPlaceholder('10529716683', '396268260');
    await setInputByPlaceholder('5a9e4adb-6ed9-484b-b5b8-303a1093c656', '9ec10c8a-7fec-44f6-aeb2-66fa01a4261e');
    await setInputByPlaceholder('Optional if Event ID resolves it', '');
    await tool('click_by_text', { text: 'Lookup' });
    await sleep(4000);
    await screenshot('app-guide-02-forensic-lookup.png');

    await clickSidebar('Dashboard');
    await sleep(1200);
    await clickChaosStoryCard();
    await sleep(2500);
    await screenshot('app-guide-03-read-only-story.png');

    await tool('click_by_text', { text: '🐛 Debug Trace' });
    await sleep(4500);
    await screenshot('app-guide-04-debug-trace.png');

    await tool('click_by_text', { text: '🗄️ Story Ledger' });
    await sleep(2500);
    await screenshot('app-guide-05-story-ledger.png');

    await clickButtonContaining('💾 Investigations');
    await sleep(800);
    await evalJson(`
      (() => {
        const textareas = Array.from(document.getElementsByTagName('textarea'));
        const inputs = Array.from(document.getElementsByTagName('input'));
        const selects = Array.from(document.getElementsByTagName('select'));
        const setValue = (el, value) => {
          if (!el) return false;
          const proto = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
          const previous = el.value;
          proto.set.call(el, value);
          const tracker = el._valueTracker;
          if (tracker) tracker.setValue(previous);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        };
        setValue(inputs.find((el) => (el.placeholder || '').includes('failure analysis')), 'Guide Demo Investigation');
        setValue(textareas.find((el) => (el.placeholder || '').includes('Short summary')), 'Saved local investigation with story context, run scope, and evidence artifacts.');
        setValue(textareas.find((el) => (el.placeholder || '').includes('Key findings')), 'Use this to preserve conclusions, selected run context, and downloadable evidence for later review.');
        const status = selects.find((el) => Array.from(el.options).some((opt) => opt.value === 'needs_review'));
        if (status) {
          status.value = 'needs_review';
          status.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return { ok: true };
      })()
    `);
    await clickButtonContaining('Save Investigation');
    await sleep(3000);
    await screenshot('app-guide-06-save-investigation.png');

    await clickSidebar('Investigations');
    await sleep(1800);
    await screenshot('app-guide-07-investigations-browser.png');

    await clickSidebar('Editor');
    await sleep(1800);
    await screenshot('app-guide-08-editor.png');

    await clickSidebar('Settings');
    await sleep(1800);
    await screenshot('app-guide-09-settings.png');

    const markdown = `# Tines Desktop User Guide

This guide was generated by walking the live Electron app through \`@iflow-mcp/electron-mcp-server\` and capturing screenshots from the running UI.

## Tooling Check

- MCP tools discovered: ${toolNames.join(', ')}
- Electron window discovery completed through \`get_electron_window_info\`

## What Tines Desktop Is For

Tines Desktop is a local operational companion for Tines. It helps you:

- browse stories safely in a read-only desktop shell
- inspect recent execution behavior through Debug Trace and Story Audit Ledger
- look up old incidents by Event ID and Story Run GUID
- save local investigations with notes, screenshots, and downloadable artifacts
- separate safe browsing from higher-risk editing work

## 1. Dashboard And Read-Only Story Browser

The **Dashboard** is the default landing area after connecting a saved profile. It is intentionally browse-first and shows the app-wide read-only posture before you enter a story.

![Dashboard](./assets/app-guide-01-dashboard.png)

How this helps with Tines:

- review stories without mutating the tenant
- jump into a story for investigation
- start a forensic lookup directly from the main page

## 2. Forensic Lookup

The **Forensic Lookup** panel lets you fetch context from Tines using an old **Event ID** and **Story Run GUID**. It is useful when someone hands you a historical incident reference and you need to recover the story, action, run context, and artifacts quickly.

![Forensic Lookup](./assets/app-guide-02-forensic-lookup.png)

Use it for:

- old run triage
- incident follow-up
- converting a raw Tines identifier into an actionable story investigation

## 3. Read-Only Story View

Opening a story from the Dashboard lands you in a read-only canvas. The app keeps investigation and debugging tools available while avoiding server-mutating editing behavior in the normal browsing flow.

![Read-only story view](./assets/app-guide-03-read-only-story.png)

What to look for:

- the read-only posture
- canvas exploration and arrangement tools
- story-level metadata and status badges
- the route into Debug Trace and Story Ledger

## 4. Debug Trace

**Debug Trace** gives you a visual execution-focused view of the story. The bar at the bottom can expand for detail or collapse to a compact status pill. This is the fastest surface for spotting whether a run looks blocked, degraded, or healthy.

![Debug Trace](./assets/app-guide-04-debug-trace.png)

How it helps with Tines:

- inspect run-scoped or all-runs execution context
- compare execution evidence with live health signals
- focus on problem nodes before drilling further

## 5. Story Audit Ledger

The **Story Audit Ledger** is the table-oriented forensic surface. It is better than the canvas when you need chronological evidence, event IDs, run GUIDs, and classification-oriented review.

![Story Audit Ledger](./assets/app-guide-05-story-ledger.png)

Use it when you need to:

- review the execution trail row by row
- compare events across runs
- anchor debugging with concrete event identifiers

## 6. Saving Investigations

The **Investigations** panel inside a story is now focused on saving the current context instead of browsing every saved record inline. You can store a named local investigation with status, summary, findings, screenshot capture, and downloaded evidence artifacts.

![Save Investigation](./assets/app-guide-06-save-investigation.png)

This is useful for:

- preserving a debugging session before switching stories
- keeping notes and findings local to your machine
- building a reusable evidence packet for later review

## 7. Investigations Browser

Saved investigations live in their own top-level **Investigations** section. This is the local case browser for reopening, duplicating, exporting, and deleting saved sessions.

![Investigations browser](./assets/app-guide-07-investigations-browser.png)

Why it matters:

- investigations become durable local workspaces
- you can return to a specific story/run context later
- exports make it easier to hand off a local evidence bundle

## 8. Editor

The **Editor** section is deliberately separated from the read-only browser. It carries a warning because it is the mutation-capable area of the app and is still incomplete.

![Editor](./assets/app-guide-08-editor.png)

This separation helps keep everyday investigation safe:

- Dashboard and standard story browsing stay low-risk
- editing work is explicit and intentional
- the app makes the mutation boundary visible

## 9. Settings

The **Settings** page is the configuration area for tenant context and local debugger behavior. It is no longer used as a general editing surface.

![Settings](./assets/app-guide-09-settings.png)

This is where you manage:

- tenant configuration and connection state
- local debugging defaults
- configuration-only options that support the rest of the app

## Recommended Workflow

1. Start in **Dashboard** and browse the story safely.
2. Use **Forensic Lookup** when you already have an Event ID or Story Run GUID.
3. Open the story and move into **Debug Trace** for visual execution review.
4. Use **Story Audit Ledger** when you need exact evidence rows and identifiers.
5. Save the session to **Investigations** when the debugging path is worth preserving.
6. Enter **Editor** only when you intentionally want mutation-capable behavior.

## Notes

- The screenshots reflect live local data from the running app.
- Investigations are local to the desktop app and do not create shared Tines records.
- Some deeper runtime details depend on which Tines APIs expose them through supported desktop auth.

## Raw MCP Window Info

\`\`\`text
${getTextContent(windowInfo)}
\`\`\`
`;

    await fs.writeFile(guidePath, markdown);
    console.log(`Wrote guide to ${guidePath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
