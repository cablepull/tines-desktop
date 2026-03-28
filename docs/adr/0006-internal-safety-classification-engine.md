# ADR 0006: Internal Safety Classification Engine

## Status
Accepted

## Context
Analysts building Tines stories often struggle to distinguish between "Safe" diagnostic nodes and "Mutating" operational nodes. There is a high risk of accidentally triggering real-world changes (e.g., turning off an outlet, sending a live email) when performing dry-runs for debugging purposes.

## Decision
We decided to implement a native **Safety Classification Engine** within the Tines Desktop IDE.

1.  **Risk Taxonomy**: Every action node is classified into one of 4 tiers:
    - 🟢 **Safe**: Local data transforms (Event Transformation, Trigger).
    - 🔵 **Read-Only**: External API reads with no side effects (HTTP GET).
    - 🟡 **Interactive**: Human-facing entry points (Webhooks, Forms).
    - 🔴 **Mutating**: High-risk operations that change system state (HTTP POST/PUT/DELETE).
2.  **Automated Heuristics**: The system automatically determines the tier by inspecting `action.type` and `action.options.method`.
3.  **Manual Overrides**: Users can override the automated classification to account for edge cases (e.g., a GET request that triggers a state change on a non-standard API).
4.  **Security Visualization**: A dedicated "Safety Map" mode highlights these tiers visually on the canvas to ensure high situational awareness.

## Consequences
- **Positive**: Significantly reduced risk of accidental production mutations during testing.
- **Positive**: Faster onboarding for junior analysts who can now "see" the danger points in a story.
- **Negative**: Adds a layer of complexity to the node rendering logic and requires keeping the taxonomy up-to-date with new Tines agent releases.
