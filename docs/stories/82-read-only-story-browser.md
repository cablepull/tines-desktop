# User Story 82: Read-Only Story Browser

**As an** investigator or reviewer,  
**I want** the normal Dashboard and story canvas to be read-only,  
**so that** I can inspect stories, runs, and evidence without risking remote changes.

## Acceptance Criteria
- The Dashboard presents itself as a read-only browser.
- Opening a story from the Dashboard loads a read-only canvas.
- The read-only canvas can still support inspection, debugging, export, and local investigation persistence.
- The read-only canvas does not expose server-mutating affordances such as create, delete, connect, move, dry run, or live run.
- The UI points users to `Editor` when they need to perform remote mutations.

