# User Story 57: Interactive Node Connection

## Role
Canvas Operator

## Objective
Establish logic links between agents directly on the 2D canvas via drag-and-drop.

## Requirements
- Allow users to click a "linker" port on a node (or right-click) and drag to another node in the `Editor` canvas.
- Draw a temporary "ghost" link following the mouse cursor.
- Upon drop, call `ActionsApi.updateAction` to append the source ID to the destination node.
- Re-render the SVG path system immediately to reflect the new connection.

## Acceptance Criteria
- [ ] User can drag a line from Node A to Node B.
- [ ] Dropping on Node B creates a persistent connection.
- [ ] The terminal logs the `POST` request confirming the sync.
- [ ] The read-only story browser does not expose connection mutation affordances.
