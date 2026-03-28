# Safety-Colored JSON Context View

## Scenario
As a Security Engineer auditing the raw API payloads of an automation flow, I need to see safety classification indicators directly in the JSON view so I can identify mutating actions without switching to the Safety Map canvas.

## Acceptance Criteria
- The "Raw Context JSON" view renders each action as a separate card instead of a monolithic JSON blob.
- Each card has a color-coded header showing the action name and safety tier badge (🟢🔵🟡🔴).
- The card border and background tint match the safety tier color.
- Tier overrides from the Safety Map are reflected in the JSON view.
- Overridden nodes show the 🔓 unlock icon in their JSON card header.
