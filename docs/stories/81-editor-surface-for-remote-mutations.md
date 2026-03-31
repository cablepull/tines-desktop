# User Story 81: Editor Surface For Remote Mutations

**As a** builder making tenant changes,  
**I want** all story and canvas mutations to live in a dedicated `Editor` section,  
**so that** browsing and investigation flows remain safe by default.

## Acceptance Criteria
- The app exposes an `Editor` navigation section separate from the standard Dashboard.
- Story creation and template scaffolding are only available from `Editor`.
- Opening a story from `Editor` loads an editable canvas intended for remote mutation.
- The `Editor` surface shows a warning that it is not yet fully implemented and can mutate the tenant.

