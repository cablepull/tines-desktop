# User Story: Movable Graph Nodes

## Description
**As a** workflow architect  
**I want to** click and hold individual Action Nodes and drag them across the canvas  
**So that** I can intuitively organize and re-layout my automation graph, and have the new geographic coordinates sync directly to the Cloud workspace.

## Acceptance Criteria
- [ ] Nodes map local `onMouseDown` states specifically tracking dragging offsets in the `Editor` canvas only.
- [ ] When an individual node is grabbed, global Canvas pan tracking is suspended via `e.stopPropagation()`.
- [ ] A debounced `onMouseUp` handler triggers the Tines `ActionsApi.updateAction` endpoint, saving the new relative `{x, y}` mathematical coordinates permanently to your automation architecture.
- [ ] The read-only story browser does not allow coordinate mutation.
