# Live Event Payload Inspection

## Scenario
As a Security Engineer actively debugging an automation flow, I need to inspect the raw JSON event payloads that my actions emit after execution, directly inside the Desktop IDE without switching to the Tines web interface.

## Acceptance Criteria
- The Node Inspector drawer presents two tabs: `Configuration` (action metadata and options) and `Event Inspector` (execution payloads).
- After clicking `Execute Live Run`, the resulting JSON response automatically renders inside the Event Inspector tab.
- A `↻ Refresh` button is available to poll the latest `/api/v1/actions/{id}/events` endpoint for historical execution data.
- Connection metadata (Sources, Receivers) and positional GUID data are surfaced in the Configuration tab.
