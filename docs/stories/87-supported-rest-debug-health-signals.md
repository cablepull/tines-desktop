# User Story 87: Supported REST Debug Health Signals

**As a** debugger user,  
**I want** the app to separate execution evidence from live health signals exposed by supported REST APIs,  
**so that** the UI remains accurate even when Tines does not expose browser-log details through bearer-auth endpoints.

## Acceptance Criteria
- The debug bar distinguishes execution tallies from story/action live health tallies.
- Story-level health uses supported live-activity fields such as `not_working_actions_count`, `pending_action_runs_count`, `concurrent_runs_count`, and `tokens_used_percentage`.
- Action-level health uses supported live-activity fields such as `not_working`, `last_error_log_at`, `logs_count`, `monitor_failures`, and `pending_action_runs_count`.
- The Story Audit Ledger does not label an event row as `Healthy` when the action itself has a supported unhealthy live-activity signal.
- The UI wording makes it clear when a row only proves execution and does not prove success.
