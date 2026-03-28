# User Story: Main Tines Dashboard View

## Description
**As an** operations analyst using the desktop app  
**I want to** see a high-level dashboard of my Tines workspace immediately after opening the application  
**So that** I can rapidly assess active Stories and their general health at a glance.

## Acceptance Criteria
- [ ] Use the `StoriesApi` inside the `tines-sdk` to fetch a paginated list of stories on the main dashboard.
- [ ] Display the stories in a clean list or grid containing their names, tags, and status.
- [ ] Sort or categorize stories by recently edited or by active folders.
- [ ] Implement a refresh button or a polling mechanism to ensure the active view remains up to date.
- [ ] Implement error boundaries and visual states (loading spinners, error modals) to handle potential network connectivity issues smoothly.
