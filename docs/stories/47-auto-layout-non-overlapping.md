# Auto-Layout Non-Overlapping Node Graph

## Scenario
As a Security Engineer viewing complex automation stories with many nodes, some nodes overlap on the canvas making the graph unreadable. I need an auto-layout function that repositions nodes into a clean, non-overlapping arrangement while preserving the graph's topological flow direction.

## Acceptance Criteria
- An "Auto Layout" button in the canvas HUD triggers de-overlap repositioning.
- The algorithm respects source→receiver flow (top-to-bottom / left-to-right).
- No two nodes overlap after layout; minimum gap of 40px between nodes.
- Works in both Visual Canvas and Safety Map view modes.
- Node positions are updated in the local state (not synced to API by default).
