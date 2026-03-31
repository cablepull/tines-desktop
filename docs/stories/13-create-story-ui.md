# User Story: Create Story UI

## Description
**As an** automation builder  
**I want to** click a "New Story" button on my dashboard UI  
**So that** I don't have to leave the desktop application to spin up a new automation workspace.

## Acceptance Criteria
- [ ] Implement a visually distinct "Create New Story" card or button in the `Editor` section, not the read-only Dashboard.
- [ ] Add a small inline form or modal to capture the `name` and optional `description` of the new Story.
- [ ] Utilize the `StoriesApi.createStory` from the SDK to generate the story in Tines.
- [ ] Successfully refresh the Editor story grid and display the new Story.
