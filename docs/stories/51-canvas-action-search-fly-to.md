# Canvas Action Search with Fly-To Animation

## Scenario
As a Security Engineer navigating a complex automation story with hundreds of nodes, I need to quickly find a specific action by name, type, ID, or GUID and have the canvas automatically pan and zoom to that node so I can inspect it immediately.

## Acceptance Criteria
- A 🔍 Search button in the canvas HUD toggles a search overlay.
- Typing in the search field shows results matching Action Name, Agent Type, numeric ID (#123), or GUID.
- Selecting a result (or pressing Enter) triggers a "fly-to" animation.
- The "fly-to" animation pans and zooms the canvas to center the target node at a legible scale (~120%).
- The target node is visually highlighted with a bright ring/border for 3 seconds.
- Pressing Escape or clicking away dismisses the search overlay.
- Works in both Visual Canvas and Safety Map modes.
