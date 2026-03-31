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
  const client = new Client({ name: 'dump-chaos-debug-data', version: '1.0.0' }, { capabilities: {} });
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
    await sleep(2200);

    const body = await tool('get_body_text');
    const storyIdMatch = body.match(/ID:\s*(\d+)/);
    const storyId = storyIdMatch ? Number(storyIdMatch[1]) : 94029;

    await tool('click_by_text', { text: '🐛 Debug Trace' });
    await sleep(4500);

    const debugRunOptions = await evalJson(`
      Array.from(document.getElementsByTagName('option'))
        .map((option) => option.textContent?.trim())
        .filter(Boolean)
    `);

    const selectedRunGuid = await evalJson(`
      (() => {
        const select = document.getElementsByTagName('select')[0];
        return select ? select.value : null;
      })()
    `);

    const firstConcreteRun = await evalJson(`
      (() => {
        const options = Array.from(document.getElementsByTagName('option')).map((option) => option.value).filter(Boolean);
        return options[0] || null;
      })()
    `);

    if (!selectedRunGuid && firstConcreteRun) {
      await tool('select_option', { selector: 'select', value: firstConcreteRun });
      await sleep(2500);
    }

    const data = await evalJson(`
      (async () => {
        const activeSelect = document.getElementsByTagName('select')[0];
        const runGuid = activeSelect ? activeSelect.value || null : null;
        const summary = await window.electronAPI.dbGetDebugSummary({ storyId: ${storyId}, runGuid, sinceIso: runGuid ? null : null });
        const events = await window.electronAPI.dbGetEvents({ storyId: ${storyId}, limit: 50, offset: 0, runGuid: runGuid || undefined });
        const logs = await window.electronAPI.dbGetLogs({ storyId: ${storyId}, limit: 100, offset: 0, runGuid: runGuid || undefined });
        return {
          storyId: ${storyId},
          runGuid,
          runOptions: ${JSON.stringify(debugRunOptions)},
          summaryEventCount: summary.events.length,
          summaryLogCount: summary.logs.length,
          eventCount: events.length,
          logCount: logs.length,
          sampleEvents: events.slice(0, 12).map((e) => ({
            id: e.id,
            action_id: e.action_id,
            status: e.status,
            story_run_guid: e.story_run_guid,
            output: e.output,
            payload: e.payload,
            error: e.error
          })),
          sampleLogs: logs.slice(0, 20).map((l) => ({
            id: l.id,
            action_id: l.action_id,
            level: l.level,
            message: l.message,
            story_run_guid: l.story_run_guid,
            inbound_event: l.inbound_event,
            status: l.status,
            payload: l.payload,
            output: l.output
          }))
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
