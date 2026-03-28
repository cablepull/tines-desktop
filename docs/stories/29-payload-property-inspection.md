# Deep Component Payload Properties

## Scenario
As a logic builder, I want to click any Agent Card and have an Inspector drawer animate seamlessly into my view, providing clear, syntax-highlighted insights into the raw JSON Payload Configurations (`options` parameter) exactly as it evaluates on the server.

## Acceptance Criteria
- Clicking a Node intercepts coordinates and fires a local `inspectedAction` React state change.
- The `NodeInspector.tsx` UI slides out from the right pane.
- JSON mapping uses `white-space: pre-wrap` explicitly to handle dense HTTP Request structures inside the local UI panel.
