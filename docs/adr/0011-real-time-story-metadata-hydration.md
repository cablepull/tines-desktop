# ADR 0011: Real-time Story Metadata Hydration

## Status
Accepted

## Context
The IDE initially only fetched the `Actions` array to render the canvas. However, critical story-level attributes (e.g., `published` status, `change_control_enabled`, `locked`) remained unknown to the local client. This resulted in "metadata blindness" where a user couldn't tell if they were editing a Draft or a Production story.

## Decision
We decided to implement **Parallel Metadata Hydration** in the `StoryView.tsx` entry point.

1.  **Direct Fetching**: On story load, the `useEffect` trigger fires both `fetchActions()` and `fetchStoryMetadata()`.
2.  **SDK Mapping**: We use the native `StoriesApi.getStory` method to retrieve the full `Story` JSON model.
3.  **State-Driven UI**: Attributes like `!published` (Draft) and `changeControlEnabled` are mapped to real-time badges in the Header HUD.
4.  **Governance Feedback**: This metadata informs the "Server Locked" control state, ensuring the local UI accurately reflects the Tines Cloud reality.

## Consequences
- **Positive**: Users are fully informed of the story's lifecycle stage (Draft vs Live).
- **Positive**: Enables advanced governance features like the Server Lock toggle.
- **Negative**: Additional API call on every story load (minor performance impact).
