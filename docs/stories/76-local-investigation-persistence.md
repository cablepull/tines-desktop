# User Story 76: Local Investigation Persistence

**As a** debugger user working across multiple sessions,  
**I want** to save and reopen an investigation locally,  
**so that** I can resume analysis without rebuilding my context from scratch.

## Acceptance Criteria
- The Story view provides a visible control for saving investigations.
- A saved investigation preserves story context, selected run, selected event, focused debug node, notes, highlighted nodes, and investigation metadata such as status and summary.
- Saved investigations can be listed, reopened, duplicated, exported, and deleted locally.
- Saved investigations can carry local artifacts such as screenshot, selected event JSON, run JSON, and selected node evidence when available.
- The app stores investigation data in DuckDB without requiring a destructive schema reset.
- Reopening an investigation restores the relevant debug state in the canvas.
- The story-level investigations UI focuses on saving and updating the current investigation, while cross-story browsing happens in the dedicated Investigations section.
