# Infinite Panning Axis

## Scenario
As a Security Automation Engineer, I build massive incident-response workflows with 50+ actions. A static dashboard restricts my viewport and limits rapid analysis.

## Acceptance Criteria
- The Story Canvas implements an `overflow: hidden` bounding wrapper.
- Mouse dragging anywhere on the Canvas dynamically sets `transform: translate()` on the inner logic plane.
- The underlying visual grid continuously tracks `backgroundPosition` corresponding to mouse deltas, providing the illusion of an infinite desk mapping.
