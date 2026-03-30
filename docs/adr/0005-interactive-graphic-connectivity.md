# ADR 0005: Interactive Graphic Connectivity (Ghost Links)

## Status
Accepted

## Context
Standard Tines story editing requires a "drag-and-drop" link between nodes to define logical flow. Previously, the Desktop IDE only rendered static links from the API. To achieve "Alpha" grade interactivity, users need to visually see the connection as they drag their mouse between nodes.

## Decision
We decided to implement **Active Ghost Link Rendering** using a combination of React state and dynamic SVG path generation.

1.  **Ghost State**: A `connectingFromId` state tracks the source node, and `dragMousePos` tracks the live cursor coordinates.
2.  **Transient Pathing**: While dragging, a dedicated `<path>` element is rendered from the source node's out-port to the current mouse position, providing immediate visual feedback.
3.  **Finalization Protocol**: On `MouseUp`, if the cursor is over a valid target node, the link is finalized via an asynchronous `updateAction` call to the Tines SDK, updating the `sourceIds` array.
4.  **UI Cues**: Pulse animations on connection ports indicate valid drag starting points.

## Consequences
- **Positive**: IDE feels "alive" and responsive, matching the interactivity of the Tines Web UI.
- **Positive**: Reduces cognitive load when building complex multi-node automation topologies.
- **Negative**: Increased complexity in the `StoryView` SVG rendering layer.
