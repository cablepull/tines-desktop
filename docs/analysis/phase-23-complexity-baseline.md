# Cyclomatic Complexity Audit Report - Tines Desktop
**Status**: Baseline Snapshot (Phase 23)
**Captured**: 2026-03-28 16:20:00

## Overview
This report evaluates the logical complexity of the Tines Desktop IDE (Electron/React) using **Cyclomatic Complexity** metrics. High complexity indicates functions that are difficult to test, prone to bugs, and challenging to maintain.

**Threshold Strategy**:
- **0-10**: ✅ Low complexity (Well-structured).
- **11-20**: ⚠️ Moderate complexity (Requires attention).
- **21-50**: 🔴 High complexity (At risk - Priority refactor).
- **50+**: 💀 Extreme complexity (Critical failure - Refactor immediately).

---

## Methodology
- **Tool**: ESLint `complexity` rule.
- **Scope**: `tines-desktop/src/**/*`.
- **Date**: 2026-03-28.

---

## Key Findings (Top Hotspots)

| File | Function / Block | Complexity | Status |
|------|------------------|------------|--------|
| `StoryView.tsx` | Main Component State/Logic | **34** | 🔴 High |
| `StoryView.tsx` | Canvas Node Render Loop (JSX) | **32** | 🔴 High |
| `NodeInspector.tsx` | Main Inspector Component | **19** | ⚠️ Moderate |
| `Dashboard.tsx` | Story Fetching/Search logic | **18** | ⚠️ Moderate |
| `StoryView.tsx` | `classifyAction` Utility | **16** | ⚠️ Moderate |

---

## Analysis & Recommendations

### 1. Canvas Overload (`StoryView.tsx`)
The `StoryView` component is currently a "God Component". It manages infinite panning, zoom, auto-layout, search state, and unified export logic in one file. 
- **Recommendation**: Split coordinate state into a `useCanvas` hook and extract the node-rendering loop into a `CanvasSurface` component.

### 2. Inspector Bloat (`NodeInspector.tsx`)
The inspector handles raw JSON viewing, configuration forms, and live event debugging in a single large function.
- **Recommendation**: Decompose into `InspectorTabConfig`, `InspectorTabEvents`, and `InspectorTabRaw` sub-components.

### 3. Classification Hardcoding
The safety engine relies on a single function with deep nested switches.
- **Recommendation**: Move `classifyAction` to a dedicated `safetyEngine.ts` utility with a lookup map of agent types to reduce decision branches.

---

## Optimization Roadmap
The following User Stories have been created to address these hotspots:
1. `53-refactor-canvas-render-logic.md` (Priority: High)
2. `54-decouple-storyview-state.md` (Priority: High)
3. `55-decompose-node-inspector.md` (Priority: Medium)
4. `56-extract-safety-classification-logic.md` (Priority: Medium)
