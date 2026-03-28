# ADR 0007: Topological Depth-First Auto-Layout

## Status
Accepted

## Context
As Tines stories grow in complexity, nodes often overlap or become disorganized, making it impossible to read the logical flow without manually dragging dozens of cards. Standard grid-layout tools are insufficient because they do not reflect the dependency relationships of the story.

## Decision
We implemented a **Topological Auto-Layout Algorithm** based on BFS (Breadth-First Search) principles.

1.  **Dependency Depth**: The algorithm calculates the "depth" of each node by tracing paths from root triggers (sources = [] or Webhooks).
2.  **Row Distribution**: Each depth level is assigned a unique vertical row (`y` axis).
3.  **Column distribution**: Nodes at the same depth are distributed horizontally (`x` axis) with fixed spacing to prevent physical overlap.
4.  **Linear Connectivity**: This results in a left-to-right (or top-to-bottom) logical flow that mirrors a professional automation IDE.

## Consequences
- **Positive**: Instant cleanup of messy graphs with a single click.
- **Positive**: Guaranteed zero-overlap between node cards, ensuring legibility for exports.
- **Negative**: Does not account for "back-references" or complex cycles, which may still require manual adjustment after the initial auto-layout.
