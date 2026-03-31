# RCA 16: Debugger Log Parity And Supported Health Signals

## Problem

The desktop debugger was overstating confidence about run health.

- The Debug Trace bar counted mostly story events.
- The Story Audit Ledger often showed `EVENT` rows as `Healthy` because the event status was `info`.
- In the native Tines UI, the same chaos-story actions clearly showed operational failures such as `401`, `404`, and `500` in the action logs surface.

The core question became:

- why does Tines show failure detail for these actions while the desktop app does not?

## Expected Behavior

We expected the desktop debugger to reconstruct:

- what executed
- what failed
- whether the failure was local flow-breaking or external-system related

For the chaos story, that meant the debug bar and Story Audit Ledger should not imply `Healthy` when the Tines UI was already showing action-log failures.

## Investigation

### 1. Verified the problem in the live Electron app

Using the Electron MCP server against the running app, we:

- opened the chaos story from Dashboard
- entered `🐛 Debug Trace`
- opened `🗄️ Story Ledger`
- confirmed that the ledger was populated with real event rows and run GUIDs
- confirmed that the debug bar did not match the operational picture seen in Tines

This established that the bug was not just hypothetical. The local app was really under-reporting failure signals.

### 2. Confirmed multiple real chaos-story runs and event IDs

Using MCP and the live ledger/debugger surfaces, we captured concrete test data from the chaos story, including runs such as:

- `9ec10c8a-7fec-44f6-aeb2-66fa01a4261e`
- `c145a6a3-dbc7-4e9f-894e-15e4aed70ecd`

and event IDs such as:

- `396268260`
- `396268229`
- `396268186`
- `396267940`

This gave us reproducible execution records for targeted probes.

### 3. Tested whether local cache/hydration was the reason logs were missing

We inspected the app’s DuckDB-backed evidence path and found:

- some scopes had `logCount: 0`
- ledger rows were therefore event-heavy or event-only

We added terminal logging and hydration logging to the app so we could see:

- run list fetches
- run detail fetches
- action event fetches
- action log fetches
- cache hits
- scope hydration decisions
- rate limiting

This produced one important operational finding:

- the earlier hydrator was causing `HTTP 429` rate-limit failures on action-log and action-event fetches

We then throttled the evidence hydrator and added in-flight deduplication.

### 4. Compared supported REST logs with what Tines UI showed

We ran narrow direct tests rather than continuing to change the app blindly.

For the chaos-story actions:

- `1227956` `Auth Error (401)`
- `1227957` `Server Error (500)`
- `1227958` `Latency (2s)`
- `1227959` `Implode & Report`

we directly fetched:

- `GET /api/v1/actions/{id}/logs?per_page=5`
- `GET /api/v1/actions/{id}/events?per_page=5`

Results:

- action events returned `200 OK` with real event rows and valid `story_run_guid`
- action logs returned `200 OK` with empty arrays for all tested actions

This was the decisive supported-API finding:

- the bearer-auth REST logs endpoint did not provide the same evidence that the Tines UI was clearly displaying

### 5. Validated that the native UI was using richer log data

The user provided a real Tines browser GraphQL payload and result for `AgentLogsQuery`.

That sample showed the missing semantics directly:

- action log `level: 4`
- messages like `Failed with 500 status code`
- inbound event linkage back to the execution event

This proved the native UI had richer log evidence than our REST path.

### 6. Tested whether desktop bearer auth could use the same GraphQL path

We briefly switched the desktop app to query the same GraphQL log shape.

Result:

- GraphQL returned `401`

This established another important boundary:

- internal/browser GraphQL was not a viable default runtime transport for the desktop app’s bearer-auth model

So even though GraphQL explained what the Tines UI was doing, it was not a supported desktop solution.

### 7. Checked the saved HAR for alternative browser-visible calls

We inspected:

- [floral-field-3735.tines.com.har](/Users/tenguns/Documents/Dev/tines-sdk/.tines-screenshots/floral-field-3735.tines.com.har)

Result:

- the file contained only one `login.tines.com` redirect request

So the HAR could not be used to recover the missing runtime request family.

### 8. Reviewed supported SDK/OpenAPI surfaces for fallback health signals

We reviewed the documented SDK/OpenAPI surfaces and confirmed that supported REST still exposes useful health metadata through story/action live-activity fields:

- action `last_error_log_at`
- action `logs_count`
- action `pending_action_runs_count`
- action `monitor_failures`
- story `not_working_actions_count`
- story `pending_action_runs_count`
- story `concurrent_runs_count`
- story `tokens_used_percentage`

This gave us a supported fallback model even though exact native log text remained unavailable.

## Root Cause

The bug was not one single defect. It was a layered mismatch:

1. The debugger treated story events as the primary truth for health.
2. Supported REST action logs did not provide parity with the Tines browser UI for the tested chaos actions.
3. The native UI relied on richer internal GraphQL log data that the desktop app could not access with bearer auth.
4. The UI wording incorrectly interpreted execution evidence as proof of health.

So the app was mixing up two different concepts:

- execution evidence
- health evidence

## Decision

We changed the debugger to use the best supported model:

- run events and action events remain the execution spine
- story/action live-activity fields become the primary supported health layer
- REST action logs remain opportunistic enrichment when available
- event rows are no longer labeled `Healthy` by default when they only prove execution

## Changes Made

Implementation was updated so that:

- the story health ribbon uses supported live-activity fields
- the debug bar separates `Exec` tallies from `Health` tallies
- node health considers action live-activity signals
- the Story Audit Ledger can classify rows as:
  - `Action unhealthy`
  - `Action warning`
  - `Observed execution`
- the terminal now logs fetch/hydration activity to make evidence gaps visible

## Result

The debugger is now more honest and more defensible:

- it still reconstructs execution runs
- it still surfaces supported operational health
- it no longer overclaims parity with the native Tines log UI when supported APIs do not provide that data

## Remaining Limitation

The desktop app still cannot guarantee exact native Tines log-text parity for chaos-story error actions such as `401`, `404`, and `500` because:

- supported REST `/actions/{id}/logs` returned empty arrays in our tests
- browser GraphQL returned `401` from the desktop auth context

That is now a documented product limitation rather than an undocumented mismatch.
