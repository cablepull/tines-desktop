# Export Graph as Multi-Page PDF with Stitchable Grid

## Scenario
As a Security Engineer preparing audit documentation, I need to export the full automation graph as a multi-page PDF where:
- Page 1 is an overview of the entire graph (zoomed to fit one page)
- Subsequent pages show stitchable grid sections at readable zoom, each capturing a group of nodes clearly
- A numbered grid overlay on the overview page shows which section corresponds to which detail page

## Acceptance Criteria
- An "Export PDF" button generates a downloadable multi-page PDF.
- Page 1: Full graph overview with numbered grid overlay.
- Pages 2+: Each grid cell rendered at legible zoom with its grid number label.
- Grid cells are sized so that node text is clearly readable (minimum effective zoom ~80%).
- Works for both Visual Canvas and Safety Map modes.
- Grid numbers on overview match the page numbers of detail pages.
