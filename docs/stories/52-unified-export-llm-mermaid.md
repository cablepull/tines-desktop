# Unified Export & LLM Graph Format

## Scenario
As a Security Architect, I need to export the automation story in various formats for different stakeholders: high-resolution SVG for presentations, multi-page stitched PDF for physical walk-throughs, and a text-based graph format for AI agents (LLMs) to analyze or document.

## Acceptance Criteria
- A single "📤 Export" button in the HUD replaces individual SVG/PDF buttons.
- Clicking "📤 Export" opens a menu with three options:
    - **🖼️ SVG Image**: Static vector export of the current view.
    - **📄 PDF Document**: Multi-page overview with numbered grid overlay and stitchable detail pages.
    - **🤖 Mermaid (.mmd)**: A text-based graph representation in Mermaid syntax, optimized for LLMs.
- Mermaid export includes:
    - Proper node names and agent types.
    - All functional connections (sources to targets).
    - Styling classes for safety tiers (safe, read-only, interactive, mutating).
- Tooltips are updated to reflect the new unified menu behavior.
- Works in both Visual Canvas and Safety Map modes.
