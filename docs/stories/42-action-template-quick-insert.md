# Action Template Quick-Insert

## Scenario
As a Security Engineer who frequently builds similar automation patterns, I want pre-defined templates (e.g., "Slack Notification", "Jira Ticket", "Conditional Branch") that I can one-click insert into a Story canvas instead of manually configuring each action's type and options from scratch.

## Acceptance Criteria
- A "Templates" section exists in the Create Action drawer (collapsible).
- At least 7 common templates are available covering webhook, HTTP, email, LLM, and trigger patterns.
- Clicking a template auto-fills the action name, type, and default options, then creates it via the API.
- The canvas reloads to show the newly created templated action.
