# Safety Tier Override Controls

## Scenario
As a Security Engineer reviewing an automation graph's risk profile, I may disagree with the auto-classification of certain nodes. For example, an HTTP POST that only writes to a logging system is functionally non-mutating for testing purposes. I need to unlock and reclassify any node's safety tier to reflect operational reality.

## Acceptance Criteria
- In Safety Map mode, clicking a node's tier badge cycles through all 4 tiers: Safe → Read-Only → Interactive → Mutating → Safe.
- Overridden nodes display a 🔓 unlock icon to indicate manual reclassification.
- Right-clicking the badge resets the node back to its auto-detected classification.
- Overrides are reflected in SVG link colors, node background tints, and the legend counts.
- Overrides persist for the session and do not affect the underlying Tines API data.
