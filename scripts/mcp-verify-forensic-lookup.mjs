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
  const client = new Client({ name: 'verify-forensic-lookup', version: '1.0.0' }, { capabilities: {} });
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

  const evalJson = async (code) => parseMaybeJson(await tool('eval', { code }));

  try {
    await client.connect(transport);

    const initialBody = await tool('get_body_text');
    if (initialBody.includes('Select a saved profile') && initialBody.includes('Connect')) {
      await tool('click_by_text', { text: 'Connect' });
      await sleep(2500);
    }

    await tool('click_by_text', { text: 'Dashboard' });
    await sleep(1500);

    const setInput = async (index, value) => {
      await tool('eval', {
        code: `
          (() => {
            const input = document.getElementsByTagName('input')[${index}];
            if (!input) return { ok: false, index: ${index} };
            const previous = input.value;
            const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
            proto.set.call(input, ${JSON.stringify(value)});
            const tracker = input._valueTracker;
            if (tracker) tracker.setValue(previous);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return { ok: true, index: ${index}, value: input.value };
          })()
        `,
      });
    };

    await setInput(0, '396268260');
    await setInput(1, '');
    await setInput(2, '');
    await sleep(1200);

    await tool('eval', {
      code: `
        (() => {
          const panel = Array.from(document.querySelectorAll('div')).find((node) => (node.textContent || '').includes('Forensic Lookup'));
          const button = panel ? Array.from(panel.getElementsByTagName('button')).find((candidate) => (candidate.textContent || '').trim() === 'Lookup') : null;
          if (!button) return { ok: false };
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return { ok: true };
        })()
      `,
    });
    await sleep(4000);

    const summary = await evalJson(`
      (() => {
        const body = document.body.innerText;
        const openStoryButton = Array.from(document.getElementsByTagName('button')).some((button) => (button.textContent || '').includes('Open Story'));
        const eventHeader = Array.from(document.getElementsByTagName('div')).find((node) => (node.textContent || '').trim().startsWith('Event #'));
        const storyIdText = body.match(/Story ID:\\s*(\\d+)/)?.[1] || null;
        const runText = body.match(/Run:\\s*([0-9a-f-]{36})/)?.[1] || null;
        const retentionGap = body.includes('outside retention') || body.includes('no longer available');
        const actionLogsEmpty = body.includes('No action logs matched this run.');
        const upstreamEmpty = body.includes('No upstream events recorded on this event.');
        const actionLine = body.match(/Action:\\s*(.+)/)?.[1] || null;
        return {
          openStoryButton,
          eventHeader: eventHeader ? eventHeader.textContent.trim() : null,
          storyIdText,
          runText,
          retentionGap,
          actionLogsEmpty,
          upstreamEmpty,
          actionLine,
          bodySnippet: body.slice(0, 2500),
        };
      })()
    `);
    const bodyText = await tool('get_body_text');

    console.log(JSON.stringify({ summary, bodyText }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
