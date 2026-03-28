# Canvas Zoom Scaling

## Scenario
As a Tines Developer mapping highly complex execution logic graphs containing 30-50 nodes, the fixed 100% viewpoint strictly limits my holistic view of the Story network. I need explicit and intuitive optical zooming to smoothly scale my graph's dimensionality.

## Acceptance Criteria
- Canvas viewport natively intercepts vertical scroll events (`onWheel`) shifting a React `zoom` state metric clamped cleanly between `0.1` and `2.0`.
- The absolute positioning mapping evaluates an instantaneous CSS string transition: `transform: translate({x}, {y}) scale({zoom})` globally resizing the graphical hierarchy.
- Provide a persistent navigational overlay on the Canvas containing explicit physical buttons (`+`, `-`, and `100%`) for explicit touch-screen operations.
