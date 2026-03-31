# User Story 75: Forensic Lookup by Event ID and Run GUID

**As a** Tines operator investigating a historical issue,  
**I want** to look up a story execution by `Event ID` and `Story Run GUID`,  
**so that** I can recover run context even when the failure happened long ago.

## Acceptance Criteria
- A `Forensic Lookup` panel is available from the dashboard.
- The panel accepts `Event ID`, `Story Run GUID`, and optional `Story ID`.
- When an `Event ID` is provided, the app resolves the associated story and run automatically when possible.
- The lookup returns story context, event details, action context, and available lineage information.
- If the run is no longer available from the API, the UI surfaces that as a retention gap instead of a generic failure.
- Large forensic artifacts are presented in bounded cards that do not overflow the panel layout.
- Event, run, lineage, and log artifacts can be downloaded as JSON for deeper offline inspection.
- The right-hand forensic column prioritizes concise findings and artifact actions over long inline raw dumps.
