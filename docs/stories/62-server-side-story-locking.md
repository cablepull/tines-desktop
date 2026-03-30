# User Story #62: Server-Side Story Locking
**As a** Tines IDE User,
**I want** to be able to toggle the official Tines 'Locked' status for a story directly from the Desktop IDE,
**So that** I can prevent other collaborators (or myself in the Tines Web UI) from making changes to the story.

### Acceptance Criteria
- A "Server Lock" toggle is available in the Story View HUD.
- Clicking the toggle fires `storiesApi.updateStory({ locked: true/false })`.
- The status is refreshed and reflected in the "SERVER LOCKED" badge.
