# ADR 0010: Multi-Tier Story Locking Strategy

## Status
Accepted

## Context
A major risk in a collaborative automation IDE is accidental mutation—dragging a node or breaking a link while simply "inspecting" a story. Furthermore, Tines has a native server-side "Lock" feature that governs API persistence. We need a way to protect the user locally while still allowing them to manage server-side governance.

## Decision
We decided to implement a **Two-Tier Locking Strategy** in the `StoryView` component.

1.  **Safety Lock (Local/Client-Side)**:
    - **Default-On**: Every story opens with the `safetyLock` (Shield) enabled.
    - **Mutation Guard**: All local event handlers (Drag, Delete, Connect) check the `safetyLock` state before executing.
    - **Rationale**: Browsing should be safe by default.
2.  **Story Lock (Remote/Server-Side)**:
    - **API Integration**: Linked directly to the Tines `Story.locked` attribute via `storiesApi.updateStory`.
    - **Governance**: Toggling the Server Lock prevents *any* user (even in the Tines Web UI) from mutating the story once synced.
3.  **UI Differentiation**: Dedicated 🛡️ (Safety) and ☁️ (Server) toggles in the header HUD with clear semantic labeling to avoid user confusion.

## Consequences
- **Positive**: Drastically reduced risk of "fat-finger" errors during logic inspection.
- **Positive**: Direct control over Tines Governance without leaving the Desktop IDE.
- **Negative**: Adds two clicks to the "Open -> Edit" workflow, though this is a necessary safety tradeoff.
