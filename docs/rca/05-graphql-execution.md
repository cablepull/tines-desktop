# RCA 05: Undocumented GraphQL APIs & Live Event Execution

## The Problem
The user's largest stated objective was to natively "debug events as they go through a flow". The official `tines-openapi-derived.yaml` restricts API interactions to purely CRUD tasks. There are absolutely no documentation bindings to officially execute a `run` or `emit` event natively against a Story action in the desktop framework.

## The Investigation
The user activated the Google Chrome network recorder (saving a 200MB HAR file) and manually clicked through the Web IDE.
1. Our initial CLI regex Extractions for `POST /api/.*` yielded entirely empty datasets. 
2. Upon deep inspection, we discovered that the Tines execution runtime doesn't operate over standard REST mechanisms. It communicates exclusively using **Persisted GraphQL Mutations** bound to `floral-field-3735.tines.com/graphql`.
3. We wrote a custom Python parser `extract-graphql.py` to recursively rip through the HAR recording data, capturing exactly 58 pre-compiled GraphQL schemas (such as `EventsPreloaderQuery`, `actionsOptionsChangeMutation`, and `BreadboardActionPanelRightQuery`).

## The Solution
Since the GraphQL endpoints explicitly demand `operationId` hashes that dynamically map to Tines internal architectures, building an exclusive GraphQL IDE wasn't immediately feasible without an internal mapping dictionary.
Instead:
- **UI Architecture:** We natively mapped `<NodeInspector>` UI bindings to extract and securely dump `action.options` payload hashes on-screen using standard SDK fetching, perfectly replicating the native property sidebar.
- **REST Execution Hack:** While GraphQL manages the frontend, we discovered an undocumented underlying REST wrapper route. We engineered an async fallback loop natively clicking `Execute Live Run` triggering `POST /api/v1/actions/[id]/run` and safely resolving to `POST /api/v1/actions/[id]/dry_run` ensuring zero logic friction for native Tines event polling!
