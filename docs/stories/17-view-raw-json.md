# User Story: View Native Story JSON Data

## Description
**As an** advanced SecOps engineer  
**I want to** visually inspect the raw Tines JSON properties defining any specific Canvas  
**So that** I possess deep, low-level insight into structural parameters (ID linking, tags, folder metadata) beyond the high-level graphical UI.

## Acceptance Criteria
- [ ] Add a visual toggle pane inside `StoryView.tsx` allowing users to swap between the UI "Configured Actions" grid and a completely raw "Structural JSON Outline".
- [ ] Utilize `<pre><code>` structural wraps with `JSON.stringify({}, null, 2)` formatting.
- [ ] Retrieve deepest raw nested objects directly from the TS SDK fetch payloads.
