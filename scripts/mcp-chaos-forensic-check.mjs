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

function parseWrapped(text) {
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === 'object' && 'result' in parsed) {
    return typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
  }
  return parsed;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = new Client(
    { name: 'chaos-forensic-check', version: '1.0.0' },
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

  const evalJson = async (code) => parseWrapped(await tool('eval', { code }));

  try {
    await client.connect(transport);

    const initialBody = await tool('get_body_text');
    console.log('INITIAL_BODY');
    console.log(initialBody);

    if (initialBody.includes('Select a saved profile') && initialBody.includes('Connect')) {
      await tool('click_by_text', { text: 'Connect' });
      await sleep(2500);
    }

    await tool('click_by_text', { text: 'Dashboard' });
    await sleep(1500);

    const dashboardBody = await tool('get_body_text');
    console.log('DASHBOARD_BODY');
    console.log(dashboardBody);

    const storyTitles = await evalJson(`
      Array.from(document.getElementsByTagName('h3'))
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
    `);
    console.log('STORY_TITLES');
    console.log(JSON.stringify(storyTitles, null, 2));

    const chaosTitle = storyTitles.find((title) => title.includes('Chaos'));
    if (!chaosTitle) {
      throw new Error('Could not find a story title containing "Chaos".');
    }

    await evalJson(`
      (() => {
        const title = ${JSON.stringify(chaosTitle)};
        const headers = Array.from(document.getElementsByTagName('h3'));
        const node = headers.find((h) => (h.textContent || '').trim() === title);
        const card = node ? node.closest('div.glass-panel') : null;
        if (!card) return { clicked: false, reason: 'card not found' };
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { clicked: true, text: title };
      })()
    `);
    await sleep(2500);

    const storyHeader = await tool('get_body_text');
    console.log('STORY_VIEW_BODY');
    console.log(storyHeader);

    await tool('click_by_text', { text: '🐛 Debug Trace' });
    await sleep(5000);

    const debugBody = await tool('get_body_text');
    console.log('DEBUG_BODY');
    console.log(debugBody);

    const debugSnapshot = await evalJson(`
      (() => ({
        runOptions: Array.from(document.getElementsByTagName('option')).map((o) => o.textContent?.trim()).filter(Boolean),
        debugText: document.body.innerText.includes('🐛 DEBUG'),
        buttons: Array.from(document.getElementsByTagName('button')).map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 40),
        debugBarText: Array.from(document.getElementsByTagName('div'))
          .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
          .find((text) => text && text.includes('🐛 DEBUG') && text.includes('All Runs'))
      }))()
    `);
    console.log('DEBUG_SNAPSHOT');
    console.log(JSON.stringify(debugSnapshot, null, 2));

    await tool('click_by_text', { text: '🗄️ Story Ledger' });
    await sleep(2500);

    const ledgerRows = await evalJson(`
      Array.from((document.getElementsByTagName('tbody')[0] || { rows: [] }).rows || [])
        .map((tr) => Array.from(tr.children).map((td) => td.textContent?.trim() || ''))
        .filter((cells) => cells.length >= 6)
    `);
    console.log('LEDGER_ROWS');
    console.log(JSON.stringify(ledgerRows.slice(0, 20), null, 2));

    const eventRows = ledgerRows
      .filter((cells) => cells[1] === 'EVENT' && cells[3] && cells[3] !== 'N/A' && cells[5])
      .map((cells) => ({
        timestamp: cells[0],
        type: cells[1],
        actionName: cells[2],
        storyRunGuid: cells[3],
        status: cells[4],
        eventId: cells[5],
      }));

    console.log('EVENT_ROWS');
    console.log(JSON.stringify(eventRows.slice(0, 10), null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
