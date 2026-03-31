import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs/promises';
import path from 'path';

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

function parseMaybeWrappedJson(text) {
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
    { name: 'forensic-example-finder', version: '1.0.0' },
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

  const evalSync = async (code) => {
    const result = await tool('eval', { code });
    return result;
  };

  const outDir = path.resolve('tmp');
  await fs.mkdir(outDir, { recursive: true });

  try {
    await client.connect(transport);

    const windowInfo = await client.callTool({
      name: 'get_electron_window_info',
      arguments: { includeChildren: true },
    });
    console.log('WINDOW_INFO');
    console.log(getTextContent(windowInfo));

    let body = await tool('get_body_text');

    if (body.includes('Select a saved profile') && body.includes('Connect')) {
      await tool('click_by_text', { text: 'Connect' });
      await sleep(2500);
      body = await tool('get_body_text');
    }

    if (!body.includes('Stories')) {
      const shot = await client.callTool({
        name: 'take_screenshot',
        arguments: {},
      });
      const image = (shot.content || []).find((item) => item.type === 'image');
      if (image?.data) {
        await fs.writeFile(path.join(outDir, 'mcp-forensic-debug.png'), Buffer.from(image.data, 'base64'));
        console.log(`Saved screenshot to ${path.join(outDir, 'mcp-forensic-debug.png')}`);
      }
      throw new Error(`App did not reach dashboard. Current body text:\n${body}`);
    }

    const titlesRaw = await evalSync(`
      JSON.stringify(
        Array.from(document.getElementsByTagName('h3'))
          .map((node) => node.textContent?.trim())
          .filter(Boolean)
          .filter((text) =>
            !['Forensic Lookup', 'Connection Failed', 'STORY AUDIT LEDGER', 'FORENSIC INSPECTOR'].includes(text)
          )
      )
    `);
    console.log('TITLES_RAW', titlesRaw);
    const storyTitles = parseMaybeWrappedJson(titlesRaw);

    const findings = [];

    for (const storyTitle of storyTitles.slice(0, 6)) {
      await tool('click_by_text', { text: storyTitle });
      await sleep(2500);

      await tool('click_by_text', { text: '🐛 Debug Trace' });
      await sleep(4000);

      const debugBar = await tool('get_body_text');
      const eventMatch = debugBar.match(/Events:\s*(\d+)/);
      const eventCount = eventMatch ? Number(eventMatch[1]) : 0;

      await tool('click_by_text', { text: '🗄️ Story Ledger' });
      await sleep(1500);

      const rowsRaw = await evalSync(`
        JSON.stringify(
          Array.from((document.getElementsByTagName('tbody')[0] || { rows: [] }).rows || [])
            .map((tr) => Array.from(tr.children).map((td) => td.textContent?.trim() || ''))
            .filter((cells) => cells.length >= 6)
        )
      `);
      const rows = parseMaybeWrappedJson(rowsRaw);

      const examples = rows
        .filter((cells) => cells[1] === 'EVENT' && cells[3] && cells[3] !== 'N/A' && cells[5])
        .slice(0, 3)
        .map((cells) => ({
          storyName: storyTitle,
          timestamp: cells[0],
          type: cells[1],
          actionName: cells[2],
          storyRunGuid: cells[3],
          status: cells[4],
          eventId: cells[5],
          debugEventCount: eventCount,
        }));

      if (examples.length > 0) {
        findings.push(...examples);
      }

      await tool('click_by_text', { text: '✖️ DISMISS' });
      await sleep(500);
      await tool('click_by_text', { text: '← Back to Dashboard' });
      await sleep(1500);

      if (findings.length >= 3) break;
    }

    console.log(JSON.stringify({ findings: findings.slice(0, 5) }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
