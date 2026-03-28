# RCA 09: Canvas White Screen — Negative Coordinate Auto-Pan

## The Problem
After confirming the REST API successfully returned 32 Actions (HAR verified `agents[]` payload with `HTTP 304`), the Canvas appeared completely blank. The red debug HUD confirmed `Actions in State: 32` and `Pan Vector X: 0, Y: 0`.

## Root Cause
The Tines Web Editor positions nodes using arbitrary Cartesian coordinates that can extend deeply into negative space. The Story `93563` had its entire node cluster positioned between `X: -1920` to `X: -285` and `Y: -1335` to `Y: 525`. Since our Canvas initialized at `(0, 0)` origin, every single node was rendered thousands of pixels off-screen to the top-left of the visible viewport.

## The Solution
1. **Auto-Pan on Load**: Added a `useEffect` hook that fires when `actions` populate. It calculates the minimum bounding box (`minX`, `minY`) across all node positions and automatically offsets the pan vector to `(-minX + 100, -minY + 100)`, snapping the viewport camera directly over the graph cluster.
2. **Focus Button**: Added a permanent green `⌖ Focus Canvas Over Nodes` button in the toolbar header, allowing users to manually recenter the viewport at any time.
3. **Scroll-to-Pan**: Implemented `onWheel` free-scroll bindings so trackpad gestures naturally pan the canvas without requiring click-and-drag.
