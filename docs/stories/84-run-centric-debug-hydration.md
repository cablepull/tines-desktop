# User Story 84: Run-Centric Debug Hydration

**As a** user investigating a problematic story execution,  
**I want** the debugger to hydrate evidence from Tines run detail plus action-local logs and events,  
**so that** the debug bar and audit surfaces reflect the same execution evidence Tines exposes in its own UI.

## Acceptance Criteria
- Entering Debug Trace fetches recent story runs from Tines rather than inferring run options only from cached story events.
- For a selected `story_run_guid`, the app fetches run detail from `/stories/{story_id}/runs/{story_run_guid}` and uses it to discover participating actions.
- For participating actions, the app fetches both `/actions/{action_id}/events` and `/actions/{action_id}/logs`.
- Run-detail events, action-local events, and action logs are persisted locally and reused through DuckDB-backed debug queries.
- If no run is selected, the debugger hydrates evidence for recent runs inside the configured all-runs lookback window.
- The debug bar and related severity surfaces are derived from the persisted combined evidence, not from a single story-wide event endpoint alone.
- Supported live-activity story/action responses are also hydrated and used as a first-class health layer because REST action-log parity is not guaranteed.
