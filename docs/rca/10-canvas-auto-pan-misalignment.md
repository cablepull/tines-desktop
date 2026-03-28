# RCA 10: Canvas Auto-Pan Misalignment

## The Problem
After implementing the auto-pan feature (`⌖ Focus Canvas Over Nodes`), nodes still did not visually align with the canvas viewport. The user reported that clicking Focus left the canvas appearing blank or nodes partially clipped off-screen.

## Root Cause
The original auto-pan calculation used a naive formula: `setPan({ x: -minX + 100, y: -minY + 100 })`. This had two critical flaws:
1. **Ignored the zoom factor**: The `transform` applied `translate(x, y) scale(zoom)` with `transformOrigin: '0 0'`, meaning the pan offset must be scaled proportionally to the current zoom level.
2. **Ignored the canvas container dimensions**: The offset `+100` was an arbitrary pixel margin that didn't account for the actual visible area of the canvas `div`, leaving nodes anchored to the top-left corner rather than centered.

## The Solution
Replaced the naive offset with a proper **bounding-box center + zoom-to-fit** algorithm:
1. Calculate both the minimum AND maximum coordinates across all nodes to determine the full graph width and height.
2. Read the actual canvas container dimensions via a `useRef<HTMLDivElement>` on the canvas `div`.
3. Compute a `fitZoom` factor: `Math.min(containerW / graphW, containerH / graphH, 1)` — ensuring the entire graph fits within the viewport.
4. Calculate centered offsets: `(containerDimension / zoom - graphDimension) / 2 - minCoord`, then scale by the zoom factor.
5. Apply both the calculated zoom and pan simultaneously, ensuring perfect visual centering.
