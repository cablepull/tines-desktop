# User Story 59: Real-time Sync Status HUD

## Role
Advanced User

## Objective
Gain visual confidence that canvas changes (drags, connections, deletes) are permanently saved to the remote tenant.

## Requirements
- Implement a status indicator in the HUD:
    - `Synchronized`: Green checkmark.
    - `Syncing...`: Pulsing amber indicator.
    - `Offline/Error`: Red alert with retry.
- Track in-flight API requests and show a "Saving..." state.

## Acceptance Criteria
- [ ] Indicator pulses whenever a node is moved.
- [ ] Shows "Last Saved [Time]" after successful sync.
