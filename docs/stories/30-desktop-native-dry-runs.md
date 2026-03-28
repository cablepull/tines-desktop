# Desktop Native Dry-Runs

## Scenario
As a SOC responder, I explicitly want the capability to manually target an Action node and execute a 'Run' test live from my physical desktop application to verify logical parsing before committing to production.

## Acceptance Criteria
- The application executes native HTTP fetch requests from the Desktop bridging undocumented logic APIs.
- The `Execute Live Run` explicitly wraps `/api/v1/actions/[id]/dry_run`.
- The internal IDE Logging engine instantly slides up and captures the raw Event JSON validation structure signaling success or failure natively.
