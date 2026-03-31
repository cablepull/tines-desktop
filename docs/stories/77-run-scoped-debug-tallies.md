# User Story 77: Run-Scoped Debug Tallies

**As a** user debugging a single execution,  
**I want** the debug status bar to reflect only the selected execution run,  
**so that** I am not misled by counts aggregated from unrelated runs in the same story.

## Acceptance Criteria
- The Debug Trace bar is scoped to the currently selected `story_run_guid`.
- If no run is selected, this story does not apply and the app falls back to the configured all-runs window behavior defined separately.
- Execution totals are computed from run-filtered data.
- Run-scoped execution severity uses combined run evidence from run detail, action-local events, and action logs when available.
- Story/action live health signals are presented separately and are not misrepresented as run-specific facts.
- Run-scoped counts are derived from persisted local evidence rather than ad hoc UI state.
- Changing the selected run immediately recomputes the debug bar values.
