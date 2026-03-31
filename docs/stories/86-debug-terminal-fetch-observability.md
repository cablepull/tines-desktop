# User Story 86: Debug Terminal Fetch Observability

**As a** debugger user trying to understand why evidence is missing,  
**I want** the in-app Terminal to show detailed fetch and hydration activity,  
**so that** I can tell whether the app is loading runs, fetching logs, hitting cache, or getting rate-limited by Tines.

## Acceptance Criteria
- The Terminal logs when run lists, run detail, action events, and action logs are requested.
- The Terminal logs cache hits for locally persisted events and logs.
- The Terminal logs hydration scope, targeted runs, and participating action counts.
- Rate limiting and fetch failures are clearly visible in the Terminal without opening browser devtools.
- The Terminal header summarizes recent log levels so users can quickly see whether the app is primarily loading, succeeding, warning, or erroring.
- The Terminal makes it obvious when supported log fetches return empty results or when the app is relying on live-activity fallback signals.
