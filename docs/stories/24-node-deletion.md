# User Story: Native Node Deletion

## Description
**As an** automation builder  
**I want to** see a contextual "Delete" button hover overlay on Actions and Triggers inside the Canvas  
**So that** I can instantly destroy incorrect connections or legacy Logic agents without navigating back into the Cloud UI.

## Acceptance Criteria
- [ ] Render a sleek `✖` icon upon mouse hover over logic cards.
- [ ] Trigger the native `ActionsApi.deleteAction({ id })` HTTP deletion interface locally.
- [ ] Execute `fetchActions()` upon network completion to visually snap the deleted node out of existence and instantly re-render SVG Beziers.
