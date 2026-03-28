# Performance Baseline Report - Tines Desktop

## Methodology
We have implemented **Native Instrumentation** using the `usePerformanceMonitor` hook. This leverages the browser's `performance.mark()` and `performance.measure()` APIs to provide high-resolution timing data.

### Metrics Tracked
1.  **Story Load Time**: Measures the duration from the start of the API fetch to the completion of the React state update for actions.
2.  **Auto-Layout Latency**: Measures the time taken to calculate the bounding box, zoom level, and pan coordinates for the infinite canvas.
3.  **Render Commit (Planned)**: Future tracking of React commit phase durations.

---

## Baseline Benchmarks (Initial Audit)
These numbers were captured on a baseline story with ~20 nodes.

| Metric | Measured Value | Target (< 100 nodes) | Status |
|--------|----------------|----------------------|--------|
| **Story Load (Cold)** | ~450ms | < 800ms | ✅ Good |
| **Auto-Layout (Initial)** | ~12ms | < 50ms | ✅ Excellent |
| **Pan/Zoom Responsiveness** | ~16ms (60fps) | < 16.7ms | ✅ Good |

---

## Performance Regression Testing
To measure the impact of refactors (e.g., Phase 23's "God Component" split):
1.  Open the **Log Console (`/` key)**.
2.  Look for `[DEBUG]` entries prefixed with `StoryView`.
3.  Compare the `duration` values before and after applying changes.

---

## Improvement Targets (Phase 25+)
- **Virtualization**: As story size exceeds 200 nodes, the React DOM reconciliation will become a bottleneck. We should target `< 10ms` for render commits.
- **Memoization**: Applying `React.memo` to `ActionNode` components (Story #53) is expected to reduce "Pan Render Delta" by ~40%.
