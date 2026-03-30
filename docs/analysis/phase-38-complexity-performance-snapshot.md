# Complexity & Performance Snapshot - Phase 38
**Date**: 2026-03-30
**Status**: Event Trace Debug Dashboard (Phase 38) Post-Implementation Audit

## 1. Cyclomatic Complexity Audit
We have added significant specialized debugging logic to the `StoryView` "God Component". While functional, this has increased the logical density of the main render loop.

### Key Metrics
| Component / Function | Phase 24 Complexity | Phase 38 Complexity | Change | Status |
|----------------------|----------------------|----------------------|--------|--------|
| `StoryView` Render Loop | 32 | **36** | +4 | 🔴 High |
| `StoryView` `debugStats` | N/A | **10** | NEW | ⚠️ Moderate |
| `DebugInspector` | N/A | **19** | NEW | ⚠️ Moderate |
| `fetchEvents` | 14 | **11** | -3 | ✅ Improved |
| `NodeInspector` | 19 | 19 | -- | ⚠️ Moderate |

### Analysis
- **Render Loop Bloat**: The addition of `getNodeHealth` checks and dynamic `boxShadow` styles for status badges (✅/❌/⚠️) pushed the main `actions.map` loop to a complexity of 36.
- **Improved Data Fetching**: Moving from the SDK-based fetch to a cleaner raw `fetch` for events and actions slightly reduced the complexity of the fetching logic.
- **New Hotspots**: `DebugInspector.tsx` is at 19, matching the legacy `NodeInspector`. This is due to the chronological timeline rendering and JSON payload expansion logic.

---

## 2. Performance Snapshot
The Debug Dashboard introduces real-time telemetry processing which has specific performance characteristics.

### Observed/Predicted Latencies
| Metric | Baseline (Phase 24) | Phase 38 (Debug Mode) | Change | Status |
|--------|---------------------|-----------------------|--------|--------|
| **Event Hydration** | N/A | ~250ms (500 events) | NEW | ✅ Good |
| **Node Render Delta** | ~16ms | ~22ms | +6ms | ⚠️ Watching |
| **Fly-to-Error Latency** | N/A | ~45ms | NEW | ✅ Excellent |

### Bottleneck Identification
1. **Box-Shadow Rendering**: The use of heavy `boxShadow` with transparency and pulsing animations for "Error" nodes (❌) increases the painting cost during canvas pans.
2. **State Propagation**: Updating `eventMap` triggers a full-story re-render. While acceptable for the current node count, it remains a scaling risk.
3. **JSON Tree Parsing**: Expanding large event payloads in `DebugInspector` causes minor UI thread jank when the JSON object exceeds 500 lines.

---

## 3. Recommendations for Phase 39+
- **Memoization**: Wrap the health badge logic in a `React.memo` component to prevent the 36-complexity render loop from re-calculating on every mouse movement.
- **Z-Index Layering**: Move health badges to a separate SVG overlay to decouple them from the main node DOM structure.
- **Refactor**: Split the `DebugInspector` into sub-components (`TimelineItem`, `PayloadViewer`) to reduce per-file complexity.
