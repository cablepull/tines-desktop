# RCA 0026: God Component Structural Collapse

## Condition
During the implementation of Phase 26 (Graph Connectivity), the primary `StoryView.tsx` component suffered a massive structural failure, resulting in 22 compilation errors and an "error TS1128: Declaration or statement expected" build block.

## Cause
- **Nested Corruption**: Overlapping `replace_file_content` calls during the integration of manual REST fallbacks (for deletion) and SVG connection logic.
- **Brace Imbalance**: An extra closing brace was inadvertently left at line 462, prematurely terminating the `exportSVG` function and leaving subsequent logic as "floating" declarations.
- **Dangling Duplicates**: Multiple instances of `handleCreateAction` and `useEffect` were present in the file due to misaligned insertion ranges.

## Impact
- The build was completely broken, preventing any verification of the connectivity features.
- IDE linting was overwhelmed by 20+ errors, hiding the root cause (the brace imbalance).

## Resolution
- **Full Component Surgery**: The component body was surgically reconstructed by flattening all handlers and ensuring a single valid scope for all JSX references.
- **Constant Extraction**: Shared constants like `NODE_W` and `NODE_H` were moved to the top-level of the component to prevent "Cannot find name" errors in helper functions like `exportPDF`.
- **Deduplication**: Verified every handler (`handleCreateAction`, `fetchActions`) was unique and properly scoped.

## Prevention
- **Avoid Large Block Replaces**: Break down God Component edits into smaller, function-specific `replace_file_content` calls.
- **Lint Checkpoints**: Run `npm run build` or `tsc` immediately after every major structural change.
