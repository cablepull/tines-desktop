# User Story 80: Settings-Driven All-Runs Debug Window

**As a** debugger user reviewing a story broadly,  
**I want** the `All Runs` debug view to aggregate only over a configured recent time window,  
**so that** the tallies remain useful and do not silently mix stale executions with current activity.

## Acceptance Criteria
- The Settings page exposes a configurable default debug lookback window.
- When no `story_run_guid` is selected in Debug Trace, the status bar aggregates all runs within that configured window.
- When a `story_run_guid` is selected, the status bar returns to run-scoped tallies and does not mix in other executions from the same window.
- The Debug Trace UI clearly indicates the active all-runs window.
- Switching from a specific run back to `All Runs` recomputes the tallies using the configured lookback period.
- The aggregation is backed by persisted local evidence, not an unscopeable in-memory merge of all historical runs.
- The app hydrates recent runs and action-local evidence for runs inside that window before computing the all-runs tally.
