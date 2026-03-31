# ADR 0015: Run-Centric Debug Hydration Pipeline

## Status
Accepted

## Context
The debugger originally leaned on a story-wide `/events?story_id=...` fetch, then supplemented it with a shallow pass over action logs. In practice, that left important execution evidence behind:

- recent runs were inferred from cached story events rather than the runs API
- selected-run hydration could miss action-local evidence
- action-local events and logs exposed by Tines were not treated as required inputs to the debug query path

This created a mismatch between the app’s tallies and what users saw in Tines when investigating a specific run.

## Decision
We will hydrate debugger evidence around execution runs:

1. Use `/stories/{story_id}/runs` as the source of recent run options.
2. Use `/stories/{story_id}/runs/{story_run_guid}` as the canonical run-detail fetch for a selected execution.
3. Use participating action IDs to fetch both `/actions/{action_id}/events` and `/actions/{action_id}/logs`.
4. Persist those records locally and query DuckDB for debug-bar scope and tallies.
5. Supplement run evidence with supported live-activity fields from story/action REST responses because action log parity is not guaranteed.
6. When no run is selected, hydrate the configured all-runs lookback window by traversing recent runs inside that window.

## Consequences
- Positive: run selection is anchored to explicit Tines run data instead of inferred event ordering.
- Positive: the debug bar can classify execution health using the same action-local evidence users inspect in Tines.
- Positive: supported live-activity fields provide a fallback health layer when REST action logs are sparse.
- Positive: DuckDB remains the local query surface, but it now receives richer upstream evidence.
- Negative: debug hydration requires more API calls and more careful caching than the earlier single-endpoint approach.
