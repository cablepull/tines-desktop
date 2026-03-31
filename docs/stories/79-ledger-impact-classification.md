# User Story 79: Ledger Impact Classification

**As a** forensic investigator reviewing execution history,  
**I want** the Story Audit Ledger to classify each record by impact,  
**so that** I can distinguish flow-breaking failures from external-system issues and softer warnings.

## Acceptance Criteria
- The Story Audit Ledger includes an `Impact` classification for event and log rows.
- The ledger distinguishes at least:
  - `Flow-blocking`
  - `External issue`
  - `Advisory`
  - `Action unhealthy`
  - `Observed execution`
- Log rows use the same evidence-based severity model as the debug bar instead of treating every error-level log as equivalent.
- Each classification includes enough rationale for a user to understand why it was assigned.
- The forensic inspector shows the selected row’s impact classification and explanation.
- The canvas debug bar remains concise, while the ledger carries the deeper classification detail.
- Opening the ledger hydrates current-scope action logs so the table can classify both event and log rows from the same evidence window.
- Event rows are not labeled `Healthy` merely because their event status is informational when supported action live-activity says otherwise.
