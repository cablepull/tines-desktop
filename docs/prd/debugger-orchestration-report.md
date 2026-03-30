# Tines Flow Debugger — Orchestration Report

**Product Intent (File A)**: Reconstruct execution narratives, bridge live-vs-draft gaps, and provide evidence-backed causality for story failures.
**Implementation Sequence (File B)**: Phase 1 (Foundation) → Phase 2 (Core Debugger) → Phase 3 (MVP QoL).

---

## 1. Normalized Product Understanding

### Vision & Problem Statement
The Tines Flow Debugger acts as a specialized diagnostic lens, aggregating distributed API data (Story, Run, Action, Event, Log, Record, Audit) into a single causal chain. It prioritizes **read-only fact reconstruction** over editing, making it an authoritative source for "why" a story failed.

### Core Architecture (The Evidence Model)
The system centers on a **Unified Evidence Model** that correlates internal Tines GUIDs (Actions, Runs, Events) across time and environment (Live/Test/Draft).

---

## 2. Specialized Agent Analysis

### [Product Interpretation Agent]
- **Authoritative Insight**: The gap between Tines UI "Test" mode and the REST API must be managed via "Evidence Chips." Every conclusion must disclose its API origin or missing context.
- **Constraints**: 5000 RPM global limit; action-specific limits (~100/min) are the primary throttling risk for topology hydrations.

### [Story Mapping / Delivery Agent]
- **MVP Slicing**: R1 is focused on **Observation**. Mutation (re-emit/clear memory) is strictly R2 to ensure users have full blast-radius awareness before acting.
- **Dependency Map**: The `Evidence Model` [G1] is the critical bottleneck for the `Root Cause Engine` [G2].

### [Frontend / UX Agent]
- **Command & Control Layout**:
  - **Left Rail**: Story/Team exploration.
  - **Top Ribbon**: Global story health (Pending/Token pressure).
  - **Center Canvas**: Interactive topology with "Path Highlight" and "Backlog Heatmap" overlays.
  - **Right Inspector**: Analysis-first (Explanations > Configuration).
  - **Bottom Dock**: Timeline-first (Run Sequence > Event JSON).

### [Backend / API Agent]
- **Key Discovery**: Tines documents a `story_run_guid` that enables cross-action event stitching. Successive calls to `GET /runs` and `GET /runs/{guid}` are the primary data fuel.

---

## 3. Implementation Roadmap

### Required Now (MVP)
- [ ] **A1/A2**: Secure Authentication & Story/Draft Selection.
- [ ] **B1/B2**: Metadata & Topology Hydration (Story + Actions).
- [ ] **C1**: Static Topology Graph (React/SVG-based with Pan/Zoom).
- [ ] **D1/D2**: Recent Runs List & Single Run Path Inspection.
- [ ] **E1/F1**: Logs Viewer & Live-vs-Draft Export Retrieval.
- [ ] **G1/G2**: Evidence Model & First-Pass Root Cause Summaries (Config regression vs Payload drift).
- [ ] **H1**: Local Investigation Persistence (save/load sessions).

### Optional (Post-MVP / Advanced)
- [ ] **M1/M2**: Cluster repeated failures & Anomaly detection.
- [ ] **L1/L2**: Multi-story tracing (Send to Story stitching).
- [ ] **H2**: Investigation Notebooks with screenshots/annotations.

### Blocked Tasks
- **Causality Overlays [C3]** are blocked by **Run Logic [D2]** and **Regression Diffing [F2]**.
- **Root Cause Engine [G2]** is partially blocked by **Evidence Model [G1]** maturity.
- **Explain Regression Intersection [F3]** is blocked by the **Live/Draft Diff Engine [F2]**.

### Built in Parallel (Immediate Progress)
- **Investigation Persistence [H1]** (Local storage schemas).
- **Audit Timeline [J1]** (Independent API consumer).
- **Safe Replay Preview [I2]** (Drafting UI logic before API integration).
- **Records Probe Explorer [K1]** (Independent data layer).

---

## 4. Key Assumptions & Risks
1. **Assumption**: `GET /runs/{guid}` consistently returns all events needed for a 1:1 path reconstruction without additional recursive event fetching.
2. **Assumption**: The `change_request/view` endpoint is available for all drafts, not just those with active Change Requests.
3. **Risk**: High-frequency polling for "Live Activity" may hit the 100/min `Actions` limit on large stories (>100 nodes).
4. **Risk**: "Sub-story Trace" relies on metadata preservation which can be lost if builders do not use specific Tines conventions.

---

## 5. Visualized Vision

![Debugger UI Mockup](debugger_ui_mockup_1774848545280.png)
