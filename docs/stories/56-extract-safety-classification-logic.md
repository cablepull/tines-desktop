# User Story: Extract Safety Classification Logic

## Scenario
As a security analyst, I need consistent risk classification across both the Canvas and the Global Actions Browser without duplicating complex logic.

## Current State
- `classifyAction` (Complexity: 16) is local to `StoryView.tsx`.
- The classification rules are growing more complex as we add support for all 9+ agent types.

## Acceptance Criteria
- [ ] Create `tines-desktop/src/utils/safetyEngine.ts`.
- [ ] Move `classifyAction`, `SAFETY_TIERS`, and `getEffectiveSafety` to the new utility.
- [ ] Export the `SafetyTier` type and `SafetyInfo` interface.
- [ ] Update `StoryView`, `NodeInspector`, and `ActionsPage` to use the shared utility.
- [ ] Unit test the classification engine to ensure 100% agreement between agent types and safety labels.
