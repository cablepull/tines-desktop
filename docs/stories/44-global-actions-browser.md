# Global Actions Browser

## Scenario
As a Security Engineer managing multiple automation stories, I need a single page that lists all actions across all stories so I can search, filter by type or safety tier, and quickly navigate to the relevant Story canvas.

## Acceptance Criteria
- An "Actions" page is accessible from the sidebar.
- All tenant actions are fetched via `GET /api/v1/actions?per_page=500`.
- A searchable table displays: Name, Type, Story ID, Safety Tier.
- Clicking an action row navigates to the parent Story's canvas view.
- Real-time search filters by action name or type.
