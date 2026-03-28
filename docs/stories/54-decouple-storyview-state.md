# User Story: Decouple StoryView State Management

## Scenario
As a developer, I need to add new canvas interactions (like multi-select or copy/paste) without crashing the existing coordinate and viewport logic.

## Current State
- `StoryView.tsx` (Complexity: 34) manages pan, zoom, story state, logs, and export status in one hook-heavy function.
- Viewport calculations are interleaved with API fetch logic.

## Acceptance Criteria
- [ ] Implement a `useCanvas` custom hook to manage `pan`, `zoom`, and `viewport` calculations.
- [ ] Implement a `useStoryExport` hook to handle SVG/PDF/Mermaid logic.
- [ ] Implement a `useStorySearch` hook for search indexing and fly-to animations.
- [ ] Move the `Waterfall Fetch` logic into a `useTinesFetch` hook.
- [ ] Main `StoryView` component should act primarily as an orchestrator, reducing its complexity to < 10.
