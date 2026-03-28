# User Story: Dashboard Manual Refresh

## Description
**As an** automation operator  
**I want to** be able to manually force my Dashboard grid of Stories to refresh  
**So that** I can instantly see new data generated externally by teammates or background routines without having to restart the Electron binary or re-authenticate.

## Acceptance Criteria
- [ ] Incorporate a sleek "Refresh Data" icon or button beside the `Overview` heading inside `Dashboard.tsx`.
- [ ] On click, executing this button disables it with a loading state, triggers `fetchStories(true)`, and repopulates the local React `stories` array dynamically.
- [ ] Dispatches a matching `addLog` network event verifying the manual pull.
