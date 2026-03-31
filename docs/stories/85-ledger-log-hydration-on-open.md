# User Story 85: Ledger Log Hydration On Open

**As a** forensic investigator opening the Story Audit Ledger,  
**I want** the ledger to hydrate action-log evidence for the current scope before rendering results,  
**so that** the table includes log rows instead of showing only whatever event-heavy cache happened to exist already.

## Acceptance Criteria
- Opening the Story Audit Ledger triggers evidence hydration for the current selected run or the configured all-runs lookback window.
- Ledger hydration uses the same run-centric evidence pipeline as Debug Trace.
- After hydration completes, the ledger reloads its DuckDB-backed rows automatically.
- The ledger can display both `EVENT` and `LOG` rows for the same story scope without requiring a prior debug-node inspection click.
- If Tines does not return log rows through supported REST for that scope, the ledger still surfaces action live-health classification instead of presenting informational events as definitive success.
