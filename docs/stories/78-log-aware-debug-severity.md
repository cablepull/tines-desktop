# User Story 78: Log-Aware Debug Severity

**As a** Tines user diagnosing failures,  
**I want** debug severity to include action logs as well as events,  
**so that** explicit Tines error logs are not missed when evaluating the health of a run.

## Acceptance Criteria
- The debugger correlates logs to runs using `story_run_guid` or equivalent inbound event metadata.
- Run-scoped debug summaries include error-log and warning-log counts.
- Explicit Tines error logs influence the visible debug severity for the selected run when those logs are available through supported REST transport.
- Log-derived downstream HTTP and remote-system issues are classified separately from local flow-breaking failures where evidence allows.
- Missing top-level run metadata on logs does not prevent the app from associating them to a run when `inbound_event` provides the linkage.
- Logs remain inspectable per action inside the debug workflow.
- If supported REST logs are unavailable, the debugger falls back to supported live-activity health signals rather than silently claiming success.
