# User Story #61: Local "Safety Lock" (Default-On)
**As a** Tines IDE User,
**I want** the visual canvas to be locked by default when I open a story,
**So that** I don't accidentally drag nodes or break links while simply navigating or inspecting the logic.

### Acceptance Criteria
- Upon opening `StoryView`, the local lock (renamed to "Safety Lock") is enabled by default.
- All mutation handlers (Drag, Delete, Connect) are blocked until the "Safety Lock" is explicitly disabled.
- The UI clearly distinguishes this as a local client-side safety measure.
