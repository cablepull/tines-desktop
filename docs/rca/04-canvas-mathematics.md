# RCA 04: Infinite Canvas & Bezier Graphing Mathematics

## The Problem
Tines Stories are frequently highly complex logic trees involving dozens of parallel Agents (Webhooks, HTTP Requests, Event Transformations). A simple static grid layout (used in Phase 3) makes it impossible for Security Engineers to visualize the logic flow or manage overlapping agents. The user requested an "Infinite Canvas" mirroring professional Node-based architectural IDEs, complete with physical drag-and-drop mechanics and visual linkage strings.

## The Solution
Instead of injecting heavy, bloated third-party libraries like `react-flow` that lock the DOM rendering cycle, we constructed a high-performance, mathematically native SVG + DOM graphing engine.

### 1. Canvas Draggability
We encapsulated the Story in a viewport wrapper triggering `overflow: hidden`.
- By subscribing to `onMouseDown`, `onMouseMove`, and `onMouseUp`, we dynamically track integer deltas (`e.clientX` / `e.clientY`) and apply them strictly via CSS `transform: translate(x, y)` to an inner plane.
- An underlying coordinate dot-matrix grid was drawn purely via CSS `radial-gradient` mapped securely to the physical panning state (`backgroundPosition`).

### 2. Node Typology & Destruction
- Nodes leverage `e.stopPropagation()` when clicked, detaching from the canvas-pan event loop.
- We map `action.position.x` constraints sourced directly from the Tines Cloud API into `left` and `top` integers.
- On drag completion, we explicitly emit an asynchronous update cycle hitting `ActionsApi.updateAction` to sync coordinates natively back into Tines HQ!
- Logic endpoints can be permanently purged via an injected `DELETE` REST fetch to bypass missing OpenAPI deletion bindings.

### 3. Visual SVG Connections
To draw actual mapping cables:
- We extracted the native `action.sources[]` array to identify upstream event hooks.
- An absolute `<svg>` plane overlays the viewport behind the cards. 
- Using dynamic Cartesian coordinates, we draw `<path>` arrays wrapping the endpoints. Smooth rendering is achieved exclusively utilizing Cubic Bezier formulas (`M x1 y1 C x1 yMid, x2 yMid, x2 y2`).
