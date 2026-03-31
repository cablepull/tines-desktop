import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function getTextContent(result) {
  return (result.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = new Client({ name: 'verify-editor-separation', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'mcp:start'],
    cwd: process.cwd(),
    env: { ...process.env, SECURITY_LEVEL: 'balanced' },
  });

  const tool = async (command, args = {}) => {
    const result = await client.callTool({ name: 'send_command_to_electron', arguments: { command, args } });
    return unwrapResult(getTextContent(result));
  };

  const evalResult = async (code) => {
    const raw = await tool('eval', { code });
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  try {
    await client.connect(transport);

    const initialBody = await tool('get_body_text');
    if (initialBody.includes('Select a saved profile') && initialBody.includes('Connect')) {
      await tool('click_by_text', { text: 'Connect' });
      await sleep(2500);
    }

    await tool('click_by_text', { text: 'Dashboard' });
    await sleep(1200);
    const dashboardBody = await tool('get_body_text');

    await evalResult(`
      (() => {
        const headers = Array.from(document.getElementsByTagName('h3'));
        const node = headers.find((h) => (h.textContent || '').includes('Chaos & Latency Bed'));
        const card = node ? node.closest('div.glass-panel') : null;
        if (!card) return { clicked: false };
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { clicked: true };
      })()
    `);
    await sleep(2500);
    const storyBody = await tool('get_body_text');

    await tool('click_by_text', { text: '← Back to Dashboard' });
    await sleep(1000);
    await tool('click_by_text', { text: 'Editor' });
    await sleep(1200);
    const editorBody = await tool('get_body_text');

    console.log(JSON.stringify({
      dashboardHasReadOnlyBanner: dashboardBody.includes('READ-ONLY STORY BROWSER'),
      dashboardExcerpt: dashboardBody.slice(0, 420),
      storyHasReadOnlyBadge: storyBody.includes('READ ONLY'),
      storyHasCreateActionDrawer: storyBody.includes('Create Action'),
      storyHasExecuteLiveRun: storyBody.includes('Execute Live Run'),
      editorHasWarning: editorBody.includes('EDITOR WARNING'),
      editorHasCreateStory: editorBody.includes('+ Blank Story'),
      editorHasLabs: editorBody.includes('EDITOR LABS'),
      editorExcerpt: editorBody.slice(0, 520),
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
