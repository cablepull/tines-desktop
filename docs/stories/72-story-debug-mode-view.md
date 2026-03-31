# User Story 72: Story Debug Mode View

**As a** Tines Story Builder,  
**I want** a dedicated "Debug Trace" view mode in the Story Canvas,  
**so that** I can see a visual overlay of recent execution health across all nodes simultaneously.

## Acceptance Criteria
- A `🐛 Debug Trace` mode is available in the view mode switcher.
- Switching to Debug mode fetches the last 500 events for the story.
- Each node displays a persistent status badge (Success, Warning, Error, or No Events).
- Node status is determined by the most recent event associated with that node.
- The debug status bar supports a collapsed compact mode and an expanded detailed mode.
- The collapsed mode shows only `🐛 Debug` and a color-dot severity indicator.
- The expanded mode exposes the fuller execution and live-health breakdown without leaving Debug Trace.
