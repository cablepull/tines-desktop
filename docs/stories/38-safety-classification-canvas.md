# Safety Classification Canvas

## Scenario
As a Security Engineer preparing to dry-run or re-emit events through an automation flow, I need to instantly identify which actions are safe to test (pure transforms, conditionals) versus which will actively mutate external systems (POST to IoT outlets, PUT to Spotify, send emails). Without this visibility, blindly executing a flow could trigger unintended real-world side effects.

## Acceptance Criteria
- A new "Safety Map" canvas view mode sits alongside "Visual Canvas" and "Raw Context JSON"
- Each action node is automatically classified into one of 4 safety tiers based on its type and HTTP method:
  - 🟢 **Safe** (Non-Mutating): EventTransformationAgent, TriggerAgent
  - 🔵 **Read-Only External**: HTTPRequestAgent with GET method, LLMAgent
  - 🟡 **Interactive** (User-Facing): FormAgent, WebhookAgent, ScheduleAgent
  - 🔴 **Mutating** (External Write): HTTPRequestAgent with POST/PUT/DELETE, EmailAgent
- Nodes display color-coded borders, tier emoji badges, and descriptive labels
- A legend panel shows all 4 tiers with their node counts
- Custom labels can be edited per-node via the Node Inspector configuration tab
- SVG connection links change color based on safety propagation
