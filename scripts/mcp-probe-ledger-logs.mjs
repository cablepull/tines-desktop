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
    { name: 'probe-ledger-logs', version: '1.0.0' },
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

    await tool('click_by_text', { text: 'Dashboard' });
    await sleep(800);

    await evalJson(`
      (() => {
        const headers = Array.from(document.getElementsByTagName('h3'));
        const node = headers.find((h) => (h.textContent || '').includes('Chaos & Latency Bed'));
        const card = node ? node.closest('div.glass-panel') : null;
        if (!card) return { clicked: false };
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { clicked: true };
      })()
    `);
    await sleep(1800);

    await tool('click_by_text', { text: '🗄️ Story Ledger' });
    await sleep(6000);

    const data = await evalJson(`
      (async () => {
        const storyId = 94029;
        const logs = await window.electronAPI.dbGetLogs({ storyId, limit: 20, offset: 0 });
        const events = await window.electronAPI.dbGetEvents({ storyId, limit: 10, offset: 0 });
        return {
          storyId,
          eventCount: events.length,
          logCount: logs.length,
          sampleLogs: logs.slice(0, 10).map((log) => ({
            id: log.id,
            action_id: log.action_id,
            level: log.level,
            message: log.message,
            run_guid: log.run_guid,
            story_run_guid: log.story_run_guid,
          })),
        };
      })()
    `);

    console.log(JSON.stringify(data, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
