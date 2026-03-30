# User Story 73: Per-Node Event Timeline

**As a** Security Operations Analyst,  
**I want** to click any node in Debug Mode to browse its chronological event history,  
**so that** I can precisely identify where data transformation or API calls failed.

## Acceptance Criteria
- Clicking a node in Debug Mode opens the `DebugInspector` drawer.
- The drawer lists events chronologically with status icons and durations.
- Clicking an individual event expands it to show the full JSON output and error messages.
- A refresh button allows re-polling current event data without closing the view.
