# ADR 0016: Supported REST Debug Health Model

## Status
Accepted

## Context
The debugger attempted to match the native Tines UI by combining story events with action logs. In practice, the bearer-auth REST path does not provide full parity:

- `/api/v1/actions/{action_id}/events` returns execution records and run GUIDs.
- `/api/v1/actions/{action_id}/logs` may return empty arrays for actions whose browser UI still shows detailed error logs.
- internal browser GraphQL can expose richer log text, but it is not a stable or supported desktop auth path.
- live story/action REST responses still expose useful operational health fields such as `not_working_actions_count`, `last_error_log_at`, `logs_count`, `pending_action_runs_count`, and `tokens_used_percentage`.

This means execution evidence and health evidence cannot be treated as the same thing.

## Evidence
The decision is based on direct investigation against the chaos story:

- Live MCP validation showed that the desktop ledger/debugger had real run events but still under-reported error state.
- Narrow direct probes against chaos actions `1227956`, `1227957`, `1227958`, and `1227959` showed:
  - `/api/v1/actions/{id}/events` returned real events and run GUIDs
  - `/api/v1/actions/{id}/logs` returned `200 OK` with empty arrays
- A real browser GraphQL sample for `AgentLogsQuery` showed error messages such as `Failed with 500 status code`.
- Attempting that same GraphQL path from the desktop app returned `401`.

## Decision
We will model debugger evidence in two layers:

1. Use run events and action events as the execution spine.
2. Use supported live-activity fields from story and action REST responses as the primary supported health layer.
3. Continue using REST action logs when available, but treat them as opportunistic enrichment rather than a required parity source.
4. Avoid labeling execution-only rows as `Healthy` unless supported health signals also confirm that interpretation.

## Consequences
- Positive: the debugger stays honest about what supported APIs actually prove.
- Positive: the app can still highlight not-working actions, recent error activity, and backlog without relying on unsupported GraphQL.
- Positive: the Story Audit Ledger can distinguish `observed execution` from `observed unhealthy action`.
- Positive: the debug bar can separately communicate execution scope and supported health state.
- Negative: exact native Tines log text such as HTTP `401/404/500` failure wording may remain unavailable in the desktop app.
