# User Story: Trigger & Action Visual Distinction

## Description
**As a** Tines IDE user  
**I want to** rapidly differentiate entry-point `Triggers` (e.g. Schedule, Webhook) from standard logic `Actions` (e.g. Transformers, HTTP) via visual badging  
**So that** I immediately recognize where workloads are initiated upon loading a massive Canvas.

## Acceptance Criteria
- [ ] Inject logic into the Canvas Card renderer querying `act.type`.
- [ ] Apply dedicated color-theming overlays (e.g., Green borders for `WebhookAgent`, Blue for `EventTransformation`).
- [ ] Apply recognizable icon paradigms or strict badging classifying it as a `TRIGGER` or `LOGIC NODE`.
