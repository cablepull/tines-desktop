# ADR 0012: Cross-Platform Build Strategy (electron-builder)

## Status
Accepted

## Context
The Tines Desktop IDE is currently a developer-only React/Electron project running on macOS. To reach production "Alpha" status, it must be distributable as a standalone executable on both macOS and Windows. Since the development environment is Mac, we need a reliable cross-compilation pipeline.

## Decision
We decided to adopt **electron-builder** as the primary packaging and distribution engine, focusing on local cross-compilation.

1.  **Configuration in `package.json`**: Centralize build metadata (AppId, Categories, Files) to ensure reproducible builds across environments.
2.  **Target Formats & Architectures**: 
    - **macOS**: `.dmg` (Disk Image) and `.zip`.
    - **Windows**: `.exe` (NSIS Installer) and `Portable` (single-file executable).
    - **Architecture (Windows)**: Multi-architecture targeting (**x64** and **arm64**) to ensure compatibility with standard Intel/AMD hardware.
3.  **Local Cross-Compilation**: We will use **Wine** (on macOS) to enable `electron-builder` to generate Windows binaries directly from the local development environment.
4.  **Static Asset Inclusion**: The builder is configured to scan the `dist/` directory (Vite output) and the `electron/` directory (Main/Preload) to ensure all runtime assets are bundled.

## Consequences
- **Positive**: Enables 1-click installation for non-technical security engineers on Windows.
- **Positive**: Provides a structured path to app signing and auto-updates.
- **Negative**: Windows installers generated on macOS via Wine may lack certain security signatures unless a dedicated Windows signing cert is used.
