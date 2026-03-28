# User Story: Case Management UI

## Description
**As a** security or incident responder  
**I want to** view, filter, and interact with open Tines Cases directly from the desktop client  
**So that** I can speed up my incident response workflows without losing context by constantly switching to my web browser.

## Acceptance Criteria
- [ ] Utilize the `CasesApi` to fetch a list of currently open cases.
- [ ] Display an interactive list showing Case Priority, Status, Assignee, and Open Date.
- [ ] Provide basic filters (e.g., filter by 'Open', 'Assigned to Me', or severity).
- [ ] Provide a detail view (clicking into a Case) that fetches and displays the records associated with that Case using the `CaseRecordsApi`.
- [ ] Allow users to update basic case attributes (Priority, Status, Assignee) from within the app natively.
