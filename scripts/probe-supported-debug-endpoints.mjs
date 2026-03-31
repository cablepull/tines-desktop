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

async function evalAsyncJson(tool, code, key) {
  await tool('eval', {
    code: `
      (() => {
        window.${key} = { pending: true };
        Promise.resolve()
          .then(async () => { return ${code}; })
          .then((value) => { window.${key} = { pending: false, value }; })
          .catch((error) => {
            window.${key} = {
              pending: false,
              error: error?.message || String(error),
            };
          });
        return window.${key};
      })()
    `,
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(250);
    const snapshot = parseMaybeJson(
      await tool('eval', {
        code: `(() => window.${key} || null)()`,
      })
    );
    if (snapshot && snapshot.pending === false) {
      if (snapshot.error) throw new Error(snapshot.error);
      return snapshot.value;
    }
  }

  throw new Error(`Timed out waiting for ${key}`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = new Client({ name: 'probe-supported-debug-endpoints', version: '1.0.0' }, { capabilities: {} });
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

    const profile = await evalAsyncJson(
      tool,
      `(() => window.electronAPI.getProfiles().then((profiles) => Array.isArray(profiles) ? profiles[0] || null : null))()`,
      '__profilesProbe'
    );

    if (!profile?.tenant || !profile?.apiKey) {
      throw new Error('Could not read a connected Tines profile from localStorage.');
    }

    const storyId = 94029;
    const interestingActionIds = [1227956, 1227957, 1227958, 1227959];
    const runGuid = '9ec10c8a-7fec-44f6-aeb2-66fa01a4261e';
    const eventId = 396268260;

    const result = await evalAsyncJson(
      tool,
      `(() => (async () => {
        const tenant = ${JSON.stringify(profile.tenant)};
        const apiKey = ${JSON.stringify(profile.apiKey)};
        const base = tenant.startsWith('http') ? tenant : 'https://' + tenant;
        const headers = {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        };

        const fetchJson = async (label, url) => {
          const startedAt = Date.now();
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort('timeout'), 8000);
          try {
            const res = await fetch(url, { headers, signal: controller.signal });
            const text = await res.text();
            let body;
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
            return {
              label,
              status: res.status,
              ok: res.ok,
              elapsedMs: Date.now() - startedAt,
              body,
            };
          } catch (error) {
            return {
              label,
              ok: false,
              elapsedMs: Date.now() - startedAt,
              error: error?.message || String(error),
            };
          } finally {
            clearTimeout(timeout);
          }
        };

        const storyRaw = await fetchJson('story', base + '/api/v1/stories/${storyId}?include_live_activity=true');
        const actionsRaw = await fetchJson('actions', base + '/api/v1/actions?story_id=${storyId}&per_page=100&include_live_activity=true&story_mode=LIVE');
        const actionDetailRaw = await fetchJson('actionDetail', base + '/api/v1/actions/1227957?include_live_activity=true&story_mode=LIVE');
        const runRaw = await fetchJson('run', base + '/api/v1/stories/${storyId}/runs/${runGuid}');
        const eventRaw = await fetchJson('event', base + '/api/v1/events/${eventId}');

        const storyBody = storyRaw.body && typeof storyRaw.body === 'object'
          ? {
              id: storyRaw.body.id,
              name: storyRaw.body.name,
              status: storyRaw.body.status,
              not_working_actions_count: storyRaw.body.not_working_actions_count,
              pending_action_runs_count: storyRaw.body.pending_action_runs_count,
              concurrent_runs_count: storyRaw.body.concurrent_runs_count,
              tokens_used_percentage: storyRaw.body.tokens_used_percentage,
            }
          : storyRaw.body;

        const actionsBody = Array.isArray(actionsRaw.body)
          ? actionsRaw.body
          : [];

        const interesting = actionsBody
          .filter((action) => ${JSON.stringify(interestingActionIds)}.includes(action.id))
          .map((action) => ({
            id: action.id,
            name: action.name,
            mode: action.mode,
            status: action.status,
            not_working: action.not_working,
            last_error_log_at: action.last_error_log_at,
            last_event_at: action.last_event_at,
            pending_action_runs_count: action.pending_action_runs_count,
            monitor_failures: action.monitor_failures,
          }));

        const actionDetailBody = actionDetailRaw.body && typeof actionDetailRaw.body === 'object'
          ? {
              id: actionDetailRaw.body.id,
              name: actionDetailRaw.body.name,
              mode: actionDetailRaw.body.mode,
              status: actionDetailRaw.body.status,
              not_working: actionDetailRaw.body.not_working,
              last_error_log_at: actionDetailRaw.body.last_error_log_at,
              last_event_at: actionDetailRaw.body.last_event_at,
              pending_action_runs_count: actionDetailRaw.body.pending_action_runs_count,
              options: actionDetailRaw.body.options,
            }
          : actionDetailRaw.body;

        const runBody = Array.isArray(runRaw.body)
          ? runRaw.body.slice(0, 6).map((evt) => ({
              id: evt.id,
              action_id: evt.action_id,
              status: evt.status,
              story_run_guid: evt.story_run_guid,
              previous_events_ids: evt.previous_events_ids,
              error: evt.error,
            }))
          : runRaw.body;

        const eventBody = eventRaw.body && typeof eventRaw.body === 'object'
          ? {
              id: eventRaw.body.id,
              action_id: eventRaw.body.action_id,
              status: eventRaw.body.status,
              story_run_guid: eventRaw.body.story_run_guid,
              previous_events_ids: eventRaw.body.previous_events_ids,
              payload: eventRaw.body.payload,
              output: eventRaw.body.output,
              error: eventRaw.body.error,
            }
          : eventRaw.body;

        return {
          story: {
            elapsedMs: storyRaw.elapsedMs,
            status: storyRaw.status,
            body: storyBody,
            error: storyRaw.error || null,
          },
          actions: {
            elapsedMs: actionsRaw.elapsedMs,
            status: actionsRaw.status,
            count: actionsBody.length,
            interesting,
            error: actionsRaw.error || null,
          },
          actionDetail: {
            elapsedMs: actionDetailRaw.elapsedMs,
            status: actionDetailRaw.status,
            body: actionDetailBody,
            error: actionDetailRaw.error || null,
          },
          run: {
            elapsedMs: runRaw.elapsedMs,
            status: runRaw.status,
            sample: runBody,
            error: runRaw.error || null,
          },
          event: {
            elapsedMs: eventRaw.elapsedMs,
            status: eventRaw.status,
            body: eventBody,
            error: eventRaw.error || null,
          },
        };
      })())()`,
      '__supportedDebugProbe'
    );

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
