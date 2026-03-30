# Tines Flow Debugger — Product Requirements Document

## Status

Draft v1

## Summary

Build a desktop Electron application that gives a debugger-grade view into Tines stories: topology, runs, event lineage, action logs, backlog, stateful action memory, live-vs-draft differences, and change history. The product should not just show failures; it should explain likely causes, rank confidence, and show the evidence chain behind each conclusion.

The design should be grounded in what Tines actually exposes today. Public APIs can already retrieve story metadata, action topology, run lists, run events, individual events, action logs, pending actions, records, audit logs, change requests, and selective replay via event re-emit. The major gap is that the richer saved-run and mock-payload workflow described in Tines’ Test tab is documented as a UI workflow, not as a clearly exposed public REST surface.

## 1. Problem

Tines gives strong operational visibility, but debugging a complex story still forces a builder to mentally assemble the full picture from multiple surfaces: story configuration, action topology, live activity, story runs, emitted events, upstream event IDs, action logs, change control, records, and tenant-level audit history. Events are immutable JSON objects, story runs are chains of actions and events tied together by a GUID, and action logs can show request details and inbound event context, but those pieces are distributed across different API endpoints and UI panels.

The result is that users can often answer “what failed,” but not quickly answer “why this failed now,” “what changed,” “what downstream paths were affected,” “is this data-specific or configuration-specific,” or “is the problem the action, the queue, a stateful transform, or a sub-story boundary.”

## 2. Product Vision

Create the best possible Tines debugger outside the native UI:

- It should reconstruct the runtime path of any run.
- It should show causality, not just chronology.
- It should distinguish **observed facts** from **derived hypotheses**.
- It should explain failures in human terms while preserving raw evidence.
- It should make live, test, and draft boundaries explicit.
- It should be safe by default: read-only first, mutating actions gated.

## 3. Users

### Primary users

- Tines builders debugging broken stories
- Platform engineers supporting multiple teams
- Security automation engineers tracing failed integrations
- Change reviewers trying to understand whether a draft caused a regression

### Secondary users

- Tenant admins investigating operational instability
- Team leads reviewing story health and recurring failure patterns

## 4. Goals

### Core goals

- Reconstruct a complete execution narrative for a run
- Surface probable root causes with evidence
- Visualize fan-out, branching, backlog, retries, and state retention
- Compare live vs draft definitions and explain blast radius
- Trace across Send to Story boundaries where possible
- Persist investigation context locally in the desktop app

### Non-goals

- Replacing every native Tines authoring workflow
- Acting as a full story editor
- Claiming parity with Tines’ saved-run mock testing
- Hiding uncertainty; the product must expose what is inferred

## 5. Research Baseline: What Tines Exposes Today

A selected story can be hydrated through public APIs. `GET /api/v1/stories/{story_id}` supports `story_mode=TEST|LIVE`, optional `draft_id`, and `include_live_activity=true`, returning metrics such as `pending_action_runs_count`, `concurrent_runs_count`, `tokens_used_percentage`, `not_working_actions_count`, plus draft and change-control flags. `GET /api/v1/actions` can be filtered by `story_id`, `story_mode`, and `draft_id`, and returns topology and state fields including `position`, `sources`, `receivers`, `links_to_sources`, `links_to_receivers`, `last_event_at`, `last_error_log_at`, monitoring flags, and `action_memory_contents`.

Run-level debugging is possible today. `GET /api/v1/stories/{story_id}/runs` returns `guid`, `duration`, `start_time`, `end_time`, `action_count`, `event_count`, `story_mode`, `draft_id`, and `draft_name`. `GET /api/v1/stories/{story_id}/runs/{story_run_guid}` returns the events for a run, and event records expose `story_run_guid`, `previous_events_ids`, and whether the event was re-emitted. Those fields are the backbone for reconstructing lineage and path traversal.

Action-level debugging is also available. `GET /api/v1/actions/{action_id}/logs` returns severity-filterable logs with `level`, `message`, `created_at`, and `inbound_event`. `GET /api/v1/actions/{action_id}/events` returns the emitted events for that action and supports filtering only re-emitted events. `POST /api/v1/events/{event_id}/reemit` can replay a specific event. For stateful transforms, `DELETE /api/v1/actions/{action_id}/clear_memory` applies to Event Transform actions in `deduplicate` or `implode` mode.

Operational context is available too. `GET /api/v1/stories/{story_id}/pending_actions` returns actions with outstanding queued work, ordered by highest `pending_action_runs_count` first. Audit logs capture tenant data changes, are available via API to tenant admins and users with `AUDIT_LOG_READ`, and are retained for two years. On dedicated tenants, admin job endpoints expose dead and in-progress jobs.

Tines also exposes complementary debugging primitives through records and change control. Records can be filtered by `story_container_ids`, including `test_mode=true`, and individual records expose the originating `story_run_guid`, child record relationships, and optional resolved large-text artifacts. Change request view returns both `live_story_export` and `draft_export`, which is ideal for a structured config diff.

The key gap is test and mock parity. Tines documents saved story runs, rerunning saved runs, and mock payloads in the Test tab. In change-control mode, saved draft runs cannot be pushed to live and must be re-recorded in the live story. That behavior is documented in the UI docs, but I did not find an equivalent public API workflow in the material reviewed.

## 6. Product Principles

### 6.1 Evidence first

Every explanation must decompose into:

- observed API facts
- derived correlations
- confidence score
- missing evidence

### 6.2 Runtime before prose

The app’s main view should be a runtime graph, not a table dump.

### 6.3 Debugging is comparative

Most failures are easiest to understand by comparison:

- this run vs previous successful run
- live vs draft
- current config vs change request
- emitted payload vs inbound payload
- current action state vs expected state

### 6.4 Safe by default

Read-only workflows should dominate. Re-emit and clear-memory actions should require explicit user confirmation and clear blast-radius messaging.

## 7. Ideal UI

### 7.1 Window layout

#### Left rail

- Team and story selector
- Environment selector: Live / Test / Draft
- Draft picker
- Saved investigation sessions
- Filters: failed only, backlog only, re-emitted only, sub-story only

#### Top status ribbon

- Story health summary
- Pending run count
- Concurrent runs
- Token usage percentage
- Not-working actions count
- Event retention window
- Audit and change-control indicators

This ribbon is justified because story APIs already expose those live metrics and state flags.

#### Center canvas

The main pane should be a zoomable topology and runtime surface with multiple synchronized layers:

- static topology
- selected run path
- selected event lineage
- backlog intensity
- error hotspots
- live-vs-draft diff overlay

#### Right inspector

Context-sensitive panel for:

- action config
- event payload
- log entry
- record artifact
- explanation card
- change diff
- re-emit preview

#### Bottom dock

Tabbed detail panels:

- Run timeline
- Event table
- Logs
- Records
- Audit history
- API trace
- Heuristics and root-cause engine

## 8. Visualizations the App Should Capture

### 8.1 Topology graph

A directed node-link graph reconstructed from action `sources`, `receivers`, `links_to_sources`, `links_to_receivers`, and `position`. Nodes should show action type, name, state, pending count, last event time, and last error time. Stateful transforms should visibly indicate memory presence. This is feasible because action list and get responses expose the topology and runtime fields required.

**Why this matters**

This becomes the map, but unlike the native story graph it should support overlays for:

- most recent failed path
- hot paths by run count
- dormant branches
- noisy branches
- re-emitted branches
- sub-story entry and exit seams

### 8.2 Run timeline

A time-ordered run sequence showing:

- run start and finish
- action emission order
- fan-out moments
- pauses and gaps
- retries or repeated emissions
- end-of-run failure or stall

Story runs expose `guid`, counts, duration, and times; run-event APIs expose emitted event order.

### 8.3 Event lineage DAG

A lineage graph centered on one event, walking backward through `previous_events_ids` and sideways across fan-out. This should answer:

- which upstream event produced this event
- which branch split here
- where the path diverged from healthy runs

Event APIs expose `previous_events_ids`, `story_run_guid`, and re-emission flags, which makes this visualization possible.

### 8.4 Payload structure viewer and semantic diff

A JSON viewer with:

- structural diff
- field-level drift highlighting
- type mismatch warnings
- emptiness and null detection
- path frequency heat

This is especially useful because Tines events are JSON and immutable, and logs can include the inbound event for a failing action.

### 8.5 Action health heatmap

A matrix where rows are actions and columns are signals:

- pending action runs
- last event age
- last error age
- monitor enabled
- no-event monitoring threshold
- memory usage present
- log volume
- event count

The underlying action list and get APIs already expose enough fields to compute this.

### 8.6 Backlog waterfall

A visualization of queue accumulation over time:

- story-level pending count
- per-action pending count
- concurrent runs
- token utilization
- queue hot spots

This is important because a large class of failures are really saturation or blockage problems, not logic bugs. Tines exposes story-level live activity and per-action pending counts, plus a dedicated pending-actions endpoint.

### 8.7 Error causality graph

A layered graph connecting:

- failing action
- inbound event
- nearest config change
- upstream payload deviation
- stateful memory condition
- backlog condition
- resource or test-detail mismatch
- sub-story boundary

This is the most important insight visualization: not just where it broke, but the most plausible chain of why.

### 8.8 Live vs draft diff map

A topology overlay that marks changed nodes and edges using `live_story_export` vs `draft_export`. The app should classify diffs into:

- changed action options
- changed links
- changed notes only
- changed resources or recipients
- changed entry and exit APIs

Tines’ change request view exposes both story exports in one response, which is ideal for a structured diff engine.

### 8.9 Re-emit impact preview

Before replaying an event, the app should show:

- downstream receiving actions
- current live, test, or draft target
- whether the event was already re-emitted
- whether the target branch includes Send Email, HTTP Request, Record, or Case actions
- whether the action is monitored
- whether this looks like a safe replay candidate

Tines documents event re-emission in both the API and docs, and notes a limit of 500 events re-emitted at one time in the UI behavior.

### 8.10 Sub-story trace map

A cross-story trace that highlights Send to Story boundaries and preserves caller metadata. Tines documents that Send to Story includes metadata such as calling `event_id`, `action_id`, `story_id`, `team_id`, `story_run_guid`, `draft_id`, and `group_id`, and notes that `STORY_RUN_GUID()` yields the calling story’s GUID in both caller and sub-story while `META.story_run.id` yields the sub-story GUID.

### 8.11 Records probe explorer

If teams instrument stories with Record actions, the app should visualize records as debugger probes:

- by story
- by run
- by parent and child chain
- with resolved artifact payloads
- split by live and test mode

Tines records APIs support story-based filtering, test-mode filtering, child-record traversal, and full artifact resolution.

### 8.12 Retention and blind-spot dashboard

The app should surface when evidence may already be gone. Tines’ event retention setting governs events, action logs, and unsaved story runs, but not audit logs. Audit logs are retained for two years. This means the debugger should explicitly say when a root-cause chain is incomplete because runtime artifacts aged out while config-change evidence still exists.

## 9. How the API Calls Should Be Chained

### 9.1 Story bootstrap chain

When the user selects a story:

1. `GET /stories/{story_id}?story_mode=...&draft_id=...&include_live_activity=true`
2. `GET /actions?story_id=...&story_mode=...&draft_id=...&include_live_activity=true`
3. `GET /stories/{story_id}/pending_actions?story_mode=...`
4. If change control is enabled and a draft is selected: `GET /stories/{story_id}/change_request/view?draft_id=...`

This yields story state, topology, pending work, and live-vs-draft diff material in one initial hydration.

### 9.2 Run investigation chain

When the user selects a run:

1. `GET /stories/{story_id}/runs?...`
2. `GET /stories/{story_id}/runs/{story_run_guid}?...`
3. For selected events: `GET /events/{event_id}`
4. For suspect actions: `GET /actions/{action_id}/logs`
5. If deeper action-local history is needed: `GET /actions/{action_id}/events`

This chain supports a layered drill-down from run summary to path to event payload to action-local logs and history.

### 9.3 Root-cause chain

For a failed action, the app should automatically compute:

- **Config evidence:** action options, topology links, draft/live diff
- **Runtime evidence:** inbound event, emitted events, run path, queue state
- **State evidence:** action memory contents, deduplicate or implode memory applicability
- **Operational evidence:** pending counts, concurrent runs, token pressure, dead or in-progress jobs on dedicated tenants
- **Change evidence:** nearest audit log entries and change request contents
- **Probe evidence:** related records and artifacts if instrumentation exists

Every “why” card in the UI should be backed by this chain. The app is not guessing in the dark; it is correlating multiple evidence layers already available in Tines.

### 9.4 Live-vs-draft explanation chain

To explain whether a draft likely caused a regression:

1. Pull the selected story in live and draft modes
2. Pull actions in both live and draft modes
3. Pull change request view for `live_story_export` and `draft_export`
4. Classify diffs by type
5. Compare recent successful live runs vs recent failing draft runs
6. Highlight only changed nodes that intersect the failing run path

This narrows the blame surface dramatically.

### 9.5 Replay chain

For a selected event:

1. Load the event and confirm path
2. Load receiving actions and inspect their current modes
3. Warn about downstream external-effect actions
4. Let user re-emit the single event
5. Immediately poll action events and story runs for resulting changes

Tines supports event-specific re-emission, so the UI should preserve that granularity.

### 9.6 Records instrumentation chain

For teams using records as checkpoints:

1. `GET /record_types`
2. `GET /records?story_container_ids[]=...&test_mode=...`
3. `GET /records/{record_id}?resolve_artifacts=true`
4. Traverse child records if present

This gives the app a probe layer even when raw event retention is short.

## 10. Explanation Engine

The app should produce machine-assisted but evidence-backed explanations such as:

### Example: configuration regression

“Action X is the first node on the failing path whose configuration differs between live and draft. The inbound payload shape is unchanged relative to the last successful live run, but the action options changed in the draft export. Confidence: high.”

### Example: queue saturation

“Story health shows elevated pending runs and concurrent execution, and the failing action has a high pending count with no recent successful events. This is more consistent with backlog or rate pressure than a deterministic logic error. Confidence: medium.”

### Example: stateful deduplication trap

“An Event Transform action in deduplicate or implode mode is stateful and currently holds memory. Incoming payload values match recent historical values, making suppression plausible. Confidence: medium.”

### Example: data drift

“Action logs show an inbound event, but the selected JSON path is now null or type-shifted compared with prior successful runs. Confidence: high.”

### Example: sub-story trace ambiguity

“The branch crosses a Send to Story boundary. Caller metadata is present, but the apparent run GUID may refer to the calling story; use sub-story `META.story_run.id` semantics for exact sub-story run identity. Confidence: high.”

## 11. Functional Requirements

### 11.1 Story loading

- User can authenticate with a Tines API key
- User can browse teams, stories, and drafts
- User can pin favorite stories
- App caches topology and recent run summaries locally

### 11.2 Topology and path tracing

- Render story graph from actions API
- Highlight selected run
- Highlight selected event path
- Highlight nodes changed in draft
- Highlight group and sub-story boundaries

### 11.3 Runtime inspection

- Show recent runs
- Show event lineage
- Show action-local event history
- Show action logs with severity filters
- Show raw JSON and structured diffs

### 11.4 Operational diagnosis

- Show pending actions sorted by pressure
- Show story-wide live activity
- Show not-working actions
- Show token pressure and event-limit risk
- Show retention expiry warnings

### 11.5 Change analysis

- Show audit timeline for the story
- Show draft/live export diff
- Correlate nearest changes to failing path
- Explain whether a change request likely affected the failing route

### 11.6 Replay and remediation

- Re-emit a selected event
- Clear eligible action memory
- Require explicit confirmation
- Show post-action polling results
- Maintain an investigation journal of every mutable step

### 11.7 Records and artifacts

- Surface record checkpoints by run and by story
- Resolve large text artifacts inline
- Traverse child-record chains
- Split live and test record views

## 12. Non-Functional Requirements

### Security

- Store API keys in the OS keychain
- Default to least-privilege team or service keys
- Explain permission failures clearly; Tines notes that underprivileged keys can return `404 Not Found` for protected resources

### Performance

- Respect pagination and rate limits
- Batch and cache hydrations
- Prefer incremental polling for run and event views

### Reliability

- Degrade gracefully when evidence ages out
- Mark stale caches clearly
- Maintain an API trace panel for every investigation

### Transparency

Every explanation card must link back to:

- API source
- retrieved fields
- timestamp
- confidence
- any missing evidence

## 13. UX Details That Make It “Perfect”

### 13.1 Dual-mode inspection

Every pane should have:

- **Explain** mode for causal summaries
- **Raw** mode for exact API data

### 13.2 Time-travel slider

A slider should let the user move through runs or event history and watch the topology color itself accordingly.

### 13.3 “Why this action is red”

Clicking a red node should open a deterministic explanation:

- failed because of log error
- failed because no event emitted after last error
- failed because backlog
- failed because config changed
- failed because upstream data changed
- failed because dedupe memory may have suppressed
- failed because sub-story input mismatch

### 13.4 Confidence visualization

Use a simple meter:

- High = direct evidence
- Medium = multi-signal inference
- Low = partial evidence, retention gap, or missing permissions

### 13.5 Evidence chips

Each explanation should have chips like:

- `config diff`
- `queue pressure`
- `inbound payload drift`
- `state memory`
- `audit change`
- `sub-story boundary`
- `retention gap`

### 13.6 Investigation notebooks

Allow the user to save an investigation as a narrative:

- screenshots
- selected runs
- selected events
- explanation cards
- action log excerpts
- change diffs

## 14. Known Product Constraints

The app can be exceptionally deep, but it should not pretend that public APIs expose everything the Test tab does. Tines documents saved runs, mock payloads, and test-result diffs in the UI, including that mocked actions can prevent real outbound interactions during a rerun. That is a major workflow, but based on the materials reviewed it should be treated as an external or native capability rather than something this app can fully reproduce through public REST APIs alone.

Similarly, evidence retention is a structural limit. Events, action logs, and unsaved story runs can age out according to story retention, while audit logs persist for two years. The app should explicitly show where conclusions are constrained by data retention rather than by analytic weakness.

## 15. MVP

### MVP scope

- Authenticate with API key
- Load story, actions, and pending actions
- Render topology graph
- Load runs and run events
- Inspect event payloads and action logs
- Generate first-pass root-cause summaries
- Show draft/live diff using change request exports
- Support single-event re-emit
- Save local investigations

### MVP success criteria

- A user can identify first failing action in under 60 seconds
- A user can explain why a run failed, with evidence, in under 5 minutes
- A user can differentiate config regressions from payload regressions from queue issues
- A user can safely re-emit one event with full blast-radius awareness

## 16. Phase 2

- Sub-story trace stitching across multiple stories
- Record-type auto-discovery and probe dashboards
- Event-pattern clustering across repeated failures
- Run-to-run anomaly detection
- Tenant-level operational dashboards
- Dedicated-tenant job diagnostics
- Exportable incident report generation
- Optional LLM explanation mode constrained to retrieved evidence

## 17. Research Appendix

### Confirmed runtime-debugging surfaces

- Story metadata with live activity, draft, and health fields
- Action topology and action memory via list and get actions
- Pending-actions backlog view
- Story runs and run-event retrieval
- Event retrieval with lineage IDs and re-emission markers
- Action logs with severity and inbound event
- Action event history
- Event re-emit endpoint
- Clear-memory endpoint for deduplicate and implode transforms
- Records list and get with live/test filtering, child relationships, and artifact resolution
- Audit logs via API, 2-year retention, S3 export support
- Change request exports for live-vs-draft diffing

### Confirmed behavioral semantics

- Events are JSON, timestamped, and write-once
- Story runs are identified by GUIDs
- Send to Story preserves caller metadata and has run-GUID nuances across sub-stories
- Tines supports saved runs and mock payloads in the native Test UI, but saved draft runs cannot be promoted to live
- Resources can have Test Details used by drafts when change control is enabled
- Event retention governs events, action logs, and unsaved story runs, but not audit logs
- Daily story and tenant event limits can pause runs until reset; 80 percent threshold notifications exist

### Operational constraints

- Most APIs: 5000 requests per minute
- `actions`: 100 per minute
- `audit_logs`: 1000 per minute
- `records`: 400 per minute

### Design conclusion

A near-ideal Tines debugger is possible today with public APIs, as long as the product is explicit about one boundary: it can fully excel at **runtime reconstruction, causal diagnosis, diffing, backlog analysis, and evidence correlation**, but it should treat **saved-run mock testing** as a native-Tines adjunct rather than pretending the public API already exposes all of it.