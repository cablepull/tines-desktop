# User Story: Refactor Canvas Node Render Logic

## Scenario
As a developer, I need to modify node rendering behavior without navigating through a 1,000+ line file, ensuring the canvas remains high-performance and maintainable.

## Current State
- `StoryView.tsx` contains a giant `.map()` loop (Complexity: 32) that handles Action cards, Board comments, and Highlight rings in a single block of JSX.
- Mixing rendering logic with business logic makes bugs harder to isolate.

## Acceptance Criteria
- [ ] Create a dedicated `ActionNode.tsx` component to handle individual action card rendering.
- [ ] Create a `BoardComment.tsx` component for sticky notes.
- [ ] Extract the SVG link generation into a `CanvasLinks` component.
- [ ] Reduce the complexity of the main `StoryView` render block to < 10.
- [ ] Ensure no regressions in node dragging or hover interactions.
