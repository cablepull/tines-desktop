# ADR 0004: Native SVG Bezier Graphing vs React-Flow

## Status
Accepted

## Context
Rendering a complex drag-and-drop Visual Programming language natively in a browser normally warrants massive topology engines (e.g. `react-flow` or `d3.js`). These libraries possess enormous DOM-tree overhead and enforce rigid custom-node architectures that conflict deeply with our explicit API response bindings.

## Decision
We elected to build a completely native React array renderer. 
- Nodes execute their own `transform: translate()` mouse mapping geometry.
- The visual linking network natively loops standard `action.sources` IDs, executing lightweight mid-point calculations directly into `<path>` objects using standard CSS Cubic Bezier mappings (`M x1 y1 C x1 yMid, x2 yMid, x2 y2`).

## Consequences
- **Positive:** Ultra-lightweight graph render cycle yielding smooth 60fps tracking during Infinite Panning.
- **Positive:** Complete styling freedom for Typology colors (Trigger green, Modifier blue) mapping inherently to the core Tines design language.
- **Negative:** Manual maintenance of z-indexing and event propagation hooks (`e.stopPropagation()`) during overlapping Drag & Drop conflicts.
