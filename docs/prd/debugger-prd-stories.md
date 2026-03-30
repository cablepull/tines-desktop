# Tines Flow Debugger — User Stories and Story Map

## Scope Notes

This story map is optimized for:
- fastest path to a useful debugger
- visibility into dependency order
- clear separation of parallelizable work vs blocking work
- an MVP-first implementation sequence

Legend:
- `P0` = foundational / earliest
- `P1` = important MVP follow-on
- `P2` = post-MVP / advanced
- `Parallel` = can be built without waiting on other major stories
- `Blocked by` = primary dependency

---

## 1. Backbone Story Map

| Backbone Activity | User Goal | Earliest Release | Parallelizable? | Notes |
|---|---|---:|---|---|
| Connect to Tines | Authenticate and select a story context | R1 | Partial | Needed before almost everything else |
| Load Story Context | Hydrate story, actions, draft/live state, pending actions | R1 | No | Core data foundation |
| Visualize Topology | See the story structure and runtime state | R1 | Partial | Can start with static graph before overlays |
| Inspect Runs | View recent story runs and choose one to debug | R1 | No | Depends on story context |
| Trace Events | Walk event lineage and payload flow | R1 | No | Depends on run loading |
| Inspect Errors | View logs, failures, queue pressure, likely cause | R1 | Partial | Log viewer can start early; causality depends on correlation |
| Compare Configurations | Compare live vs draft and explain likely regression surface | R1 | Partial | Depends on change request view and graph overlay |
| Take Safe Debug Actions | Re-emit event, clear memory, observe result | R2 | No | Requires strong warnings and evidence context |
| Investigate Historical Change | Correlate failures with config changes and audit history | R2 | Yes | Audit timeline can be added after MVP |
| Use Probes and Records | Inspect record checkpoints and artifacts | R2 | Yes | Can be built independently after core run debugger |
| Trace Across Sub-Stories | Follow Send to Story boundaries across stories | R3 | Partial | Depends on strong event/run model |
| Detect Patterns | Cluster repeated failures and anomalies across runs | R3 | Yes | Mostly additive analytics |
| Save Investigations | Persist findings, screenshots, notes, evidence | R1 | Yes | Can be built in parallel with runtime views |
| Explain Findings | Provide evidence-backed root cause summaries | R1 | Partial | Basic rules in MVP, richer heuristics later |

---

## 2. Release Slices

## R1 — MVP: “I can explain a failed run”
Focus:
- authenticate
- load story context
- render topology
- inspect runs, events, logs
- compare live vs draft
- produce first-pass explanations
- save investigation locally

## R2 — Operational Debugger: “I can safely act and correlate”
Focus:
- re-emit event
- clear action memory
- audit timeline correlation
- records/probes explorer
- stronger backlog and causality views

## R3 — Advanced Debug Intelligence: “I can analyze systems, not just runs”
Focus:
- cross-story tracing
- anomaly detection
- repeated-failure clustering
- richer causal inference
- incident-report export

---

## 3. User Stories by Epic

## Epic A — Authentication and Workspace

### A1. Connect with API key
**User story**  
As a platform engineer, I want to connect to a Tines tenant using an API key so that I can inspect stories without leaving the desktop app.

**Acceptance criteria**
- User can enter tenant URL and API key
- App validates credentials with a non-destructive API call
- Credentials are stored securely in the OS keychain
- Permission failures are surfaced clearly

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: none

### A2. Select team, story, mode, and draft
**User story**  
As a builder, I want to choose a team, story, environment mode, and draft so that I can debug the exact version I care about.

**Acceptance criteria**
- User can browse or search stories
- User can switch between live, test, and draft context
- User can select a draft when applicable
- Current context is always visibly displayed

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: A1

### A3. Persist recent workspaces
**User story**  
As a returning user, I want the app to remember recently opened stories and investigations so that I can resume debugging quickly.

**Acceptance criteria**
- Recent stories are listed
- Favorite stories can be pinned
- Last-used mode and draft selection can be restored

**Priority**: `P1`  
**Release**: `R1`  
**Parallel**

---

## Epic B — Story Hydration and Runtime Context

### B1. Load story metadata
**User story**  
As a debugger user, I want the app to load story health and configuration context so that I can orient myself before inspecting a run.

**Acceptance criteria**
- Story metadata loads on selection
- Story health ribbon shows pending runs, concurrent runs, token usage, and not-working actions
- Mode and draft indicators are shown
- Data refresh can be triggered manually

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: A2

### B2. Load actions and topology metadata
**User story**  
As a builder, I want the app to load action topology and runtime fields so that the graph and inspectors can be accurate.

**Acceptance criteria**
- Action list is loaded for current story context
- Node positions and links are captured
- Per-action fields needed for overlays are cached
- Missing or broken references are handled gracefully

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: A2

### B3. Load pending actions
**User story**  
As an operator, I want to see which actions are building backlog so that I can distinguish queue issues from logic issues.

**Acceptance criteria**
- Pending actions list loads
- Actions are sorted by pending count
- Pending state is reflected in graph and heatmap surfaces

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: A2

---

## Epic C — Topology Visualization

### C1. Render static topology graph
**User story**  
As a builder, I want to see the story graph in the desktop app so that I can understand structure without mentally reconstructing it from tables.

**Acceptance criteria**
- Actions render as nodes
- Links render as edges
- Graph supports zoom and pan
- Node selection updates the inspector panel

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: B2

### C2. Show node runtime state
**User story**  
As a debugger user, I want nodes to surface runtime health signals so that I can spot hotspots visually.

**Acceptance criteria**
- Node badges can show last error, last event, pending count, and memory presence
- Hover reveals summary tooltip
- Color semantics are consistent and documented

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: B1, B2, B3

### C3. Add overlays for failed path, backlog, and changed nodes
**User story**  
As a user investigating a problem, I want overlays on the topology so that I can focus on the relevant path instead of the entire story.

**Acceptance criteria**
- Failed path overlay can be toggled
- Backlog intensity overlay can be toggled
- Live-vs-draft changed nodes can be toggled
- Multiple overlays can coexist without ambiguity

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: C1, D2, F2

---

## Epic D — Runs and Event Tracing

### D1. List recent runs
**User story**  
As a builder, I want to browse recent runs for a story so that I can select the execution I need to inspect.

**Acceptance criteria**
- Runs table loads with start time, end time, duration, action count, event count, mode, and draft
- Runs can be filtered and sorted
- Failed and re-emitted runs are visually distinguishable where possible

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: B1

### D2. Inspect a single run
**User story**  
As a debugger user, I want to open a run and see its path and events so that I can reconstruct what actually happened.

**Acceptance criteria**
- Run detail panel shows ordered event/action sequence
- Selected run highlights the corresponding graph path
- User can jump from run step to node inspector and payload viewer

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: D1, C1

### D3. Trace event lineage
**User story**  
As a debugger user, I want to follow an event backward through its previous event IDs so that I can identify the true upstream source of a failure.

**Acceptance criteria**
- Event lineage can be expanded recursively
- Fan-out and branch points are visible
- Re-emitted events are visually marked
- User can pivot from lineage to raw payload

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: D2

### D4. Compare selected event to prior successful events
**User story**  
As a builder, I want to compare a failing payload to earlier successful payloads so that I can detect drift, nulls, and type mismatches.

**Acceptance criteria**
- User can select a baseline event or successful run
- JSON structural diff is shown
- Null, missing, and type-changed paths are highlighted

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: D3

---

## Epic E — Logs and Error Analysis

### E1. View action logs
**User story**  
As a debugger user, I want to read logs for a selected action so that I can inspect the direct evidence of errors or warnings.

**Acceptance criteria**
- Logs load for selected action
- User can filter by severity
- Log entries can show inbound event context when present
- Raw message text is preserved

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: B2

### E2. Correlate logs to the selected run
**User story**  
As a builder, I want to align logs to the run I am investigating so that I avoid mixing unrelated evidence.

**Acceptance criteria**
- Logs can be filtered or grouped by time proximity and selected run
- Relevant logs are emphasized
- Uncertain correlations are marked as such

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: E1, D2

### E3. Explain “why this node is red”
**User story**  
As a user, I want the app to summarize the strongest evidence for a node’s failure state so that I can quickly decide where to investigate next.

**Acceptance criteria**
- Explanation includes observed evidence and inferred conclusion
- Confidence level is displayed
- Missing evidence is explicitly called out
- Explanation links back to logs, event, run, and config sources

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: E1, D3, F2

---

## Epic F — Draft/Live Comparison and Change Analysis

### F1. Load live-vs-draft exports
**User story**  
As a change reviewer, I want the app to retrieve live and draft exports so that I can compare them structurally.

**Acceptance criteria**
- Change request data loads for the selected draft
- Live and draft exports are stored in normalized form
- Errors are handled when change-control artifacts are unavailable

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: A2

### F2. Render configuration diff
**User story**  
As a builder, I want changed nodes, links, and options to be highlighted so that I can narrow the likely regression surface.

**Acceptance criteria**
- Diffs are classified as node changes, edge changes, or note-only changes
- Changed actions are highlighted in the graph
- User can inspect raw field-level differences

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: F1, C1

### F3. Explain likely regression intersection
**User story**  
As a reviewer, I want the app to identify which changed nodes intersect the failing path so that I can focus on the changes most likely to matter.

**Acceptance criteria**
- App computes intersection between failing run path and changed nodes
- Explanation distinguishes direct intersection from mere coexistence
- Confidence is downgraded when the failing path does not touch changed areas

**Priority**: `P1`  
**Release**: `R1`  
**Blocked by**: F2, D2

---

## Epic G — Root Cause Engine

### G1. Build evidence model
**User story**  
As the system, I need a normalized evidence model so that different APIs can be correlated into one explanation layer.

**Acceptance criteria**
- Story, action, run, event, log, diff, and record entities share stable IDs
- Evidence sources are timestamped and traceable
- Derived relationships are stored separately from observed facts

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: B1, B2, D1, E1, F1

### G2. Generate first-pass root cause summaries
**User story**  
As a debugger user, I want the app to summarize the most likely root cause so that I can reduce time to diagnosis.

**Acceptance criteria**
- Summary distinguishes observed facts from inference
- Confidence score is shown
- Candidate causes can include config regression, data drift, queue pressure, memory state, or missing evidence
- User can inspect evidence chain

**Priority**: `P0`  
**Release**: `R1`  
**Blocked by**: G1

### G3. Rank multiple candidate causes
**User story**  
As a user, I want multiple plausible causes ranked so that I can explore ambiguity rather than being forced into one story.

**Acceptance criteria**
- At least top three candidate causes can be shown
- Ranking rationale is visible
- Contradictory signals are surfaced

**Priority**: `P1`  
**Release**: `R2`  
**Blocked by**: G2

---

## Epic H — Investigation Persistence

### H1. Save an investigation
**User story**  
As a user, I want to save selected runs, nodes, notes, and findings so that I can resume later or share internally.

**Acceptance criteria**
- Investigation can be named and saved locally
- Selected story context, run IDs, notes, and screenshots can be persisted
- Saved investigations can be reopened

**Priority**: `P1`  
**Release**: `R1`  
**Parallel`

### H2. Add evidence to notebook
**User story**  
As a user, I want to pin logs, payload diffs, and explanation cards into a notebook so that I can build a clear case.

**Acceptance criteria**
- Any evidence pane can be added to notebook
- Notebook preserves source links and timestamps
- Notebook entries can be reordered and annotated

**Priority**: `P2`  
**Release**: `R2`  
**Blocked by**: H1

---

## Epic I — Safe Debug Actions

### I1. Re-emit a selected event
**User story**  
As an experienced debugger, I want to re-emit a specific event so that I can test downstream behavior from a known checkpoint.

**Acceptance criteria**
- User can re-emit a selected event
- Warning clearly identifies possible downstream effects
- Resulting run/event activity is polled and shown after action
- Re-emitted status is visible in the UI

**Priority**: `P1`  
**Release**: `R2`  
**Blocked by**: D3, G1

### I2. Preview replay blast radius
**User story**  
As a cautious operator, I want a replay preview so that I understand what branches and actions may be triggered before I act.

**Acceptance criteria**
- Downstream receiving actions are listed
- Potential external-effect actions are flagged
- Current mode and draft context are explicit
- Preview distinguishes confidence and uncertainty

**Priority**: `P1`  
**Release**: `R2`  
**Blocked by**: I1, C1

### I3. Clear eligible action memory
**User story**  
As a builder debugging stateful transforms, I want to clear action memory for eligible actions so that I can test whether retained state is the cause.

**Acceptance criteria**
- Only eligible action types expose the control
- Warning explains what state is being cleared
- Clear action is logged in the investigation journal
- Post-clear changes are observable

**Priority**: `P1`  
**Release**: `R2`  
**Blocked by**: B2, G1

---

## Epic J — Audit and Historical Change

### J1. Show audit timeline
**User story**  
As an operator, I want to see nearby configuration changes so that I can correlate regressions to actual edits.

**Acceptance criteria**
- Audit entries can be filtered by story and time window
- Relevant operations are highlighted
- User can inspect raw inputs and outputs

**Priority**: `P1`  
**Release**: `R2`  
**Parallel`

### J2. Correlate nearest change to failure onset
**User story**  
As a reviewer, I want the app to correlate failure onset with recent changes so that I can judge whether the breakage likely followed an edit.

**Acceptance criteria**
- App can compare success/failure windows
- Nearby change events are surfaced with caution labels
- Correlation does not imply causation without evidence

**Priority**: `P2`  
**Release**: `R2`  
**Blocked by**: J1, D1, G1

---

## Epic K — Records and Probes

### K1. Browse records by story and run
**User story**  
As a builder, I want to inspect records used as checkpoints so that I can debug with intentional probes.

**Acceptance criteria**
- Records can be listed by story
- Records can be filtered by test mode
- Records can be grouped by run when possible

**Priority**: `P2`  
**Release**: `R2`  
**Parallel`

### K2. Inspect record artifacts and child chains
**User story**  
As a user, I want to inspect record artifacts and child records so that I can follow probe output through a workflow.

**Acceptance criteria**
- User can resolve large text artifacts
- Child records are linked and navigable
- Record inspector supports raw and formatted views

**Priority**: `P2`  
**Release**: `R2`  
**Blocked by**: K1

---

## Epic L — Cross-Story Tracing

### L1. Trace Send to Story boundaries
**User story**  
As a user debugging multi-story automation, I want to follow the transition across Send to Story so that I can preserve causal continuity.

**Acceptance criteria**
- App identifies sub-story boundaries
- Caller metadata is preserved
- Transition is shown visually in the investigation graph

**Priority**: `P2`  
**Release**: `R3`  
**Blocked by**: D3, G1

### L2. Stitch caller and sub-story runs
**User story**  
As a user, I want the app to stitch caller and sub-story runs into one narrative so that I do not have to debug each story in isolation.

**Acceptance criteria**
- Cross-story trace is displayed as a unified path
- Calling story GUID and sub-story run identity are clearly distinguished
- Ambiguous or missing linkage is disclosed

**Priority**: `P2`  
**Release**: `R3`  
**Blocked by**: L1

---

## Epic M — Advanced Analytics

### M1. Cluster repeated failures
**User story**  
As a platform engineer, I want repeated failures grouped by similarity so that I can identify systemic issues rather than isolated incidents.

**Acceptance criteria**
- Runs can be grouped by error signature, path, or payload-shape drift
- Cluster rationale is inspectable
- False grouping risk is exposed

**Priority**: `P2`  
**Release**: `R3`  
**Parallel`

### M2. Detect anomalous runs
**User story**  
As a user, I want anomalous runs highlighted against successful history so that unusual behavior stands out immediately.

**Acceptance criteria**
- App can flag deviations in duration, path shape, payload shape, or queue conditions
- Baseline window is configurable
- User can inspect why a run was marked anomalous

**Priority**: `P2`  
**Release**: `R3`  
**Blocked by**: D1, D3, G1

---

## 4. Implementation Order

## Phase 1 — Foundational platform
1. A1 Connect with API key
2. A2 Select team/story/mode/draft
3. B1 Load story metadata
4. B2 Load actions and topology metadata
5. G1 Build evidence model
6. C1 Render static topology graph
7. D1 List recent runs
8. E1 View action logs
9. F1 Load live-vs-draft exports

Reason:
This creates the minimum usable substrate for everything else.

## Phase 2 — Core debugger
10. D2 Inspect a single run
11. D3 Trace event lineage
12. F2 Render configuration diff
13. G2 Generate first-pass root cause summaries
14. D4 Compare selected event to prior successful events
15. E2 Correlate logs to selected run
16. C2 Show node runtime state
17. B3 Load pending actions
18. E3 Explain “why this node is red”
19. C3 Add overlays for failed path, backlog, and changed nodes

Reason:
This is the first point at which the product becomes meaningfully better than manual API inspection.

## Phase 3 — MVP quality-of-life
20. H1 Save an investigation
21. A3 Persist recent workspaces
22. F3 Explain likely regression intersection

Reason:
These features make the MVP practical for real repeated use.

## Phase 4 — Safe operational actions
23. I1 Re-emit a selected event
24. I2 Preview replay blast radius
25. I3 Clear eligible action memory

Reason:
Only introduce mutating actions after strong evidence context and graph/path visibility exist.

## Phase 5 — Historical correlation and probes
26. J1 Show audit timeline
27. J2 Correlate nearest change to failure onset
28. K1 Browse records by story and run
29. K2 Inspect record artifacts and child chains
30. H2 Add evidence to notebook
31. G3 Rank multiple candidate causes

Reason:
These deepen the investigative workflow but do not block the MVP.

## Phase 6 — Multi-story and advanced intelligence
32. L1 Trace Send to Story boundaries
33. L2 Stitch caller and sub-story runs
34. M1 Cluster repeated failures
35. M2 Detect anomalous runs

Reason:
These are high-value but require the earlier data model and debugger workflow to be mature.

---

## 5. What Can Be Implemented in Parallel

## Can start immediately once app shell exists
- A1 Connect with API key
- H1 Save an investigation
- J1 Show audit timeline
- K1 Browse records by story and run

## Can proceed once story selection exists
- B1 Load story metadata
- B2 Load actions and topology metadata
- F1 Load live-vs-draft exports

## Can proceed once actions are loaded
- C1 Render static topology graph
- E1 View action logs

## Can proceed once runs are loaded
- D1 List recent runs
- D2 Inspect a single run

## Can proceed once evidence model exists
- G2 Generate first-pass root cause summaries
- J2 Correlate nearest change to failure onset
- M1 Cluster repeated failures
- M2 Detect anomalous runs

## Can proceed after topology + run path exist
- C3 Add overlays
- F3 Explain likely regression intersection
- I2 Preview replay blast radius

---

## 6. Minimal MVP Story Set

These are the minimum stories that together produce a credible MVP:

- A1 Connect with API key
- A2 Select team/story/mode/draft
- B1 Load story metadata
- B2 Load actions and topology metadata
- C1 Render static topology graph
- D1 List recent runs
- D2 Inspect a single run
- D3 Trace event lineage
- E1 View action logs
- F1 Load live-vs-draft exports
- F2 Render configuration diff
- G1 Build evidence model
- G2 Generate first-pass root cause summaries
- H1 Save an investigation

---

## 7. MVP Definition of Done

The MVP is done when a user can:
1. select a story and mode
2. see the topology
3. open a failed run
4. trace the event lineage
5. inspect logs and payloads
6. compare live vs draft changes
7. receive an evidence-backed root cause summary
8. save the investigation for later review

---

## 8. Risks in Implementation Order

### Risk: build graph before evidence model
If the graph is built before the normalized evidence layer, overlays and explanations may be hard to retrofit cleanly.

### Risk: add replay too early
If re-emit is added before blast-radius preview and investigation context, the tool becomes operationally risky.

### Risk: overbuild analytics before core debugger works
Anomaly detection and clustering will not matter if the run debugger is still weak.

### Risk: treat all correlations as causation
Audit proximity, path intersection, and payload drift should remain evidence-backed hypotheses unless directly proven.

---

## 9. Suggested Team Split

### Track A — Platform and data
- authentication
- API client
- evidence model
- caching
- local persistence

### Track B — Visualization
- topology graph
- overlays
- run timeline
- inspectors
- diff views

### Track C — Investigation intelligence
- root cause engine
- correlation logic
- confidence model
- notebooks
- advanced analytics

### Track D — Safe actions
- re-emit flow
- clear-memory flow
- blast-radius preview
- post-action polling

This split allows substantial parallel work after the first authentication and story-loading substrate is complete.