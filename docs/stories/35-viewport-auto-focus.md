# Viewport Auto-Focus on Load

## Scenario
As a Security Engineer opening a complex Story canvas, I expect the viewport to automatically frame my node cluster regardless of where nodes are positioned in Cartesian space, preventing a disorienting blank screen experience.

## Acceptance Criteria
- On initial Action load, the IDE calculates the minimum bounding box of all node positions and offsets the pan vector to center the cluster in view.
- A persistent `⌖ Focus Canvas Over Nodes` button is available in the toolbar for manual re-centering at any time.
- Free-scroll (trackpad/mouse wheel) directly pans the canvas for natural spatial navigation.
