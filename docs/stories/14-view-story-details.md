# User Story: Story Details View

## Description
**As an** automation builder  
**I want to** click into a specific Story from the Dashboard  
**So that** I can view its canvas metadata, internal properties, and a list of all its current Actions.

## Acceptance Criteria
- [ ] Build a React routing mechanism (or state manager) to transition from the Dashboard Grid view into a single `StoryView`.
- [ ] Display the Story's header (Name, ID, Team).
- [ ] Render a pane that lists currently attached Actions (fetching from `ActionsApi` by `storyId`).
