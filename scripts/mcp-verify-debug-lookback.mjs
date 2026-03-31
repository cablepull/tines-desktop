import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function getTextContent(result) {
  return (result.content || [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = new Client(
    { name: 'verify-debug-lookback', version: '1.0.0' },
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

  try {
    await client.connect(transport);

    const initialBody = await tool('get_body_text');
    if (initialBody.includes('Select a saved profile') && initialBody.includes('Connect')) {
      await tool('click_by_text', { text: 'Connect' });
      await sleep(2500);
    }

    await tool('click_by_text', { text: 'Settings' });
    await sleep(1200);

    const settingsBody = await tool('get_body_text');

    const configuredLookback = await evalJson(`
      (() => {
        const raw = window.localStorage.getItem('tinesDesktop.debugLookbackHours');
        const selects = Array.from(document.getElementsByTagName('select'));
        const target = selects.find((s) =>
          Array.from(s.options).some((o) => (o.textContent || '').includes('Last 24 hours'))
        );
        if (!target) return null;
        target.value = '6';
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          localStorageValue: raw,
          selectedValue: target.value,
          selectedLabel: target.options[target.selectedIndex]?.textContent?.trim() || null
        };
      })()
    `);

    await sleep(500);

    const persistedLookback = await evalJson(`
      (() => ({
        localStorageValue: window.localStorage.getItem('tinesDesktop.debugLookbackHours'),
        hasDebuggingSection: document.body.innerText.includes('Default All-Runs Debug Window')
      }))()
    `);

    await tool('click_by_text', { text: 'Dashboard' });
    await sleep(1500);

    const chaosOpen = await evalJson(`
      (() => {
        const headers = Array.from(document.getElementsByTagName('h3'));
        const node = headers.find((h) => (h.textContent || '').includes('Chaos & Latency Bed'));
        const card = node ? node.closest('div.glass-panel') : null;
        if (!card) return { clicked: false };
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { clicked: true, title: node.textContent.trim() };
      })()
    `);

    await sleep(2500);
    await tool('click_by_text', { text: '🐛 Debug Trace' });
    await sleep(5000);

    const debugBody = await tool('get_body_text');
    const debugState = await evalJson(`
      (() => {
        const selects = Array.from(document.getElementsByTagName('select'));
        const target = selects.find((s) =>
          Array.from(s.options).some((o) => (o.textContent || '').includes('All Runs'))
        );
        if (!target) return null;
        return {
          options: Array.from(target.options).map((o) => o.textContent?.trim()).filter(Boolean),
          value: target.value,
          selectedLabel: target.options[target.selectedIndex]?.textContent?.trim() || null
        };
      })()
    `);

    const selectedRun = await evalJson(`
      (() => {
        const selects = Array.from(document.getElementsByTagName('select'));
        const target = selects.find((s) =>
          Array.from(s.options).some((o) => (o.textContent || '').includes('All Runs'))
        );
        if (!target || target.options.length < 2) return null;
        const firstRun = Array.from(target.options).find((o) => o.value);
        if (!firstRun) return null;
        target.value = firstRun.value;
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          selectedValue: target.value,
          selectedLabel: target.options[target.selectedIndex]?.textContent?.trim() || null
        };
      })()
    `);

    await sleep(1000);

    const revertedAllRuns = await evalJson(`
      (() => {
        const selects = Array.from(document.getElementsByTagName('select'));
        const target = selects.find((s) =>
          Array.from(s.options).some((o) => (o.textContent || '').includes('All Runs'))
        );
        if (!target) return null;
        target.value = '';
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          selectedValue: target.value,
          selectedLabel: target.options[target.selectedIndex]?.textContent?.trim() || null
        };
      })()
    `);

    const debugBarExcerpt = await evalJson(`
      (() => {
        const body = document.body.innerText || '';
        const idx = body.indexOf('🐛 DEBUG');
        return idx >= 0 ? body.slice(idx, idx + 320) : body.slice(0, 320);
      })()
    `);

    console.log(JSON.stringify({
      settingsBodyExcerpt: settingsBody.slice(0, 500),
      configuredLookback,
      persistedLookback,
      chaosOpen,
      debugBodyExcerpt: debugBody.slice(0, 500),
      debugState,
      selectedRun,
      revertedAllRuns,
      debugBarExcerpt,
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
