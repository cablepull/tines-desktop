# User Story #63: Draft & Change Control Transparency
**As a** Tines IDE User,
**I want** to see at a glance if the story on the server has an unpublished draft or if Change Control is enabled globally,
**So that** I am informed about the deployment status before making local "Safety Lock" exceptions.

### Acceptance Criteria
- A "DRAFT" badge appears if the server story is not published.
- A "CHANGE CONTROL" badge appears if the tenant-level or story-level change control is active.
- These badges are derived directly from real-time API metadata.
