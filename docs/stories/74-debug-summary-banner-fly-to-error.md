# User Story 74: Debug Summary Banner & Fly-To-Error

**As a** Tines user debugging a complex story with many nodes,  
**I want** a high-level summary of story health and a way to jump straight to problems,  
**so that** I don't have to hunt for small "red dots" in a large canvas.

## Acceptance Criteria
- A summary banner appears above the canvas in Debug Mode.
- It shows aggregate counts for Success, Warning, and Error events.
- It displays the timestamp of the last event fetch.
- Clicking the Error count automatically centers the canvas on the first failed node and opens its inspector.
