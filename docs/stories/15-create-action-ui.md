# User Story: Create Action UI

## Description
**As an** automation builder  
**I want to** be able to define and attach a new Event Action to my Story from within the desktop app  
**So that** I can rapidly scaffold logic blocks (like Webhooks, HTTP Requests) natively.

## Acceptance Criteria
- [ ] Inside the `StoryView` component, add a "Create Action" module.
- [ ] Provide inputs for Action Name, Type (e.g. `Webhook`, `Event Transformation`), and a raw JSON text area for Configuration Options.
- [ ] Dispatch to `ActionsApi.createAction(storyId, ...)` via the SDK.
- [ ] Refresh the Story's action list to visibly confirm creation.
