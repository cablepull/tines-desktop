# User Story: Decompose NodeInspector Component

## Scenario
As an engineer adding new debugging tabs (like "Logs" or "Performance"), I need a modular inspector architecture that allows tab-level isolation.

## Current State
- `NodeInspector.tsx` (Complexity: 19) handles several heterogeneous tabs and execution logic in a single file.
- State for "Live Execution" is mixed with state for "Configuration Editing".

## Acceptance Criteria
- [ ] Refactor the inspector into a Tab-based architecture.
- [ ] Create `ConfigTab.tsx` for agent settings.
- [ ] Create `EventTab.tsx` for live execution and dry-runs.
- [ ] Create `RawJsonTab.tsx` for formatted data inspection.
- [ ] Shared components (header, tab switcher) are moved to a `layout/` subfolder.
- [ ] Ensure the "Execute" button state remains responsive across tab switches.
