# User Story 58: Connection Deletion (Break Links)

## Role
Story Architect

## Objective
Remove existing logical connections between agents to reconfigure flow topology.

## Requirements
- Provide a visual "Break" or "X" button when hovering over an SVG connection line.
- Alternatively, allow selecting a connection and pressing 'Delete'.
- Update the destination node's `sources` array to remove the source ID.
- Sync the change to the Tines API.

## Acceptance Criteria
- [ ] Connection line disappears immediately upon deletion.
- [ ] The Tines API reflects the removal of the source.
