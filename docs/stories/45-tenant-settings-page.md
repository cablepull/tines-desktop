# Tenant Settings Page

## Scenario
As a Security Engineer managing a Tines tenant, I need a Settings page to view tenant info, team membership, and credential inventory without navigating to the cloud UI.

## Acceptance Criteria
- A "Settings" page is accessible from the sidebar.
- Displays tenant domain and API connectivity status.
- Lists all teams from `GET /api/v1/teams` with member counts.
- Lists all user credentials from `GET /api/v1/user_credentials` (names only, no secrets).
- Includes a link to the existing secure profile management.
