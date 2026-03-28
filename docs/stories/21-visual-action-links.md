# User Story: Visual SVG Node Linking

## Description
**As an** automation operator  
**I want to** visually see the relational arrows connecting my specific Actions and Triggers on the canvas  
**So that** I understand the linear execution path of my Story intuitively without reading raw JSON blocks.

## Acceptance Criteria
- [ ] Parse `sourceIds` (or `receiverIds`) natively from the Tines `Action` schema payloads.
- [ ] Iterate through all known Actions and dynamically construct SVG `<line>` or `<path>` geometry on a plane sitting immediately underneath the Action cards.
- [ ] Calculate the geometric center or edges of the `(x, y)` coordinate containers to seamlessly anchor the SVG line ends.
