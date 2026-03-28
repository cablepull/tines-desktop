# ADR 0008: Stitchable Multi-page Document Export

## Status
Accepted

## Context
Tines stories are often too large to fit on a single standard page (Letter/A4) while remaining legible. Exporting a single giant image makes details unreadable, while simple cropping loses the context of the overall network topology.

## Decision
We implemented a **Stitchable Multi-page PDF Export** architecture utilizing `jspdf` and `html2canvas`.

1.  **Reference Grid**: The canvas can be divided into a logical grid (e.g., 2000x1200 cells).
2.  **Overview Map**: Page 1 of the PDF contains a full overview of the graph with a numbered overlay corresponding to downstream pages.
3.  **Sectioned Detail Pages**: Subsequent pages zoom into each numbered grid cell at a 1.0x (100%) or legible reference scale.
4.  **Physical Synthesis**: The pages include numbering (e.g., "Page 3 — Row 1, Col 2") providing a blueprint for physical printing and wall-stitching of large automation maps.

## Consequences
- **Positive**: Enables "wall-sized" visualization of massive automation ecosystems without losing fidelity.
- **Positive**: Provides a professional documentation asset for audit and review meetings.
- **Negative**: Generating high-fidelity details for 20+ pages can be resource-intensive in the Electron renderer.
