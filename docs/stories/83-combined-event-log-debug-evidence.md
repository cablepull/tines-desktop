# User Story 83: Combined Event And Log Debug Evidence

**As a** debugger user investigating a problematic run,  
**I want** severity and tally calculations to use run detail, action-local events, and action logs,  
**so that** the app reflects failures Tines surfaces in logs even when event rows remain superficially healthy.

## Acceptance Criteria
- The debug bar uses combined run-detail events, action-local events, and action logs for blocking, external, and warning tallies.
- Node severity uses the same combined evidence model for the selected run or all-runs lookback scope.
- Error-level logs are further distinguished between local flow-breaking failures and downstream external-system issues when evidence allows.
- Action-log transport should stay on supported auth paths for the desktop app; browser-only internal GraphQL should be treated as a semantic reference rather than the default runtime transport.
- The Story Audit Ledger uses the same classification model as the debug bar for log rows.
- When supported REST logs are unavailable or incomplete, live-activity fields from story and action responses supplement the health model instead of being treated as secondary decoration.
