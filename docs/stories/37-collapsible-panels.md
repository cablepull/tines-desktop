# Collapsible Navigation & Tools

## Scenario
As a Security Engineer working with complex 30+ node graphs, I need maximum screen real estate dedicated to the canvas. The fixed sidebar and always-visible Create Action panel consume valuable horizontal space.

## Acceptance Criteria
- The left sidebar has a toggle button (`◂`/`▸`) that collapses it to a 60px icon-only rail showing single-letter navigation labels.
- The right-side Create Action drawer has a toggle button that collapses it to a 40px sliver.
- Both panels animate smoothly via CSS transitions (width + padding).
- Collapsed state persists during the session and provides tooltip-style titles on hover.
- The canvas automatically fills the freed horizontal space.
