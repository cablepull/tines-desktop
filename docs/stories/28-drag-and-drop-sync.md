# Drag & Drop Layout Syncing

## Scenario
As a builder, I heavily rely on visually categorizing my workflow structures. I want to grab Action Nodes natively and rearrange their layout within the Desktop Application IDE, permanently synchronizing those integer coordinates securely to my Tines Cloud tenant.

## Acceptance Criteria
- Action Nodes implement an isolation layer bypassing the global Canvas Pan interaction `e.stopPropagation()`.
- Moving an action overrides internal layout maps with new X/Y geometries.
- `onMouseUp` implicitly triggers `actionsApi.updateAction` flushing native configuration properties safely back to remote storage.
