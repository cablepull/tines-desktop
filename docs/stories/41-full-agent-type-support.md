# Full Agent Type Support in Create Action

## Scenario
As a Security Engineer building automations in the Desktop IDE, I can only create 3 of the 9+ available Tines agent types. I need access to EmailAgent, TriggerAgent, LLMAgent, SendToStoryAgent, FormAgent, IMAPAgent, and GroupAgent to build complete automation workflows without switching to the cloud UI.

## Acceptance Criteria
- The Create Action dropdown lists all 9 agent types from the Tines OpenAPI specification.
- Types are grouped by category (Entry Points, Logic, Communication, Advanced).
- Each option has a human-readable description (e.g., "HTTP Request — Make API calls").
- Creating any agent type produces the correct Tines API payload.
