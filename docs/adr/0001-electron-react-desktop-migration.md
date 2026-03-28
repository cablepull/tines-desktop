# ADR 0001: Electron + React Vite Architecture

## Status
Accepted

## Context
The user initially operated using rigid `PowerShell` CLI scripts (e.g., `Build-TinesFlow.ps1`) referencing flat JSON definition structs and `cURL` commands to interact with the Tines REST API. This provided no visual topology for complex Incident Response automation structures and hindered rapid iterative debugging.

## Decision
We elected to bootstrap a native desktop application migrating the environment into an **Electron + React Vite (TypeScript)** ecosystem. 

## Consequences
- **Positive:** Grants the user an immediate Visual IDE Canvas, complete with infinite panning, node dragging, live execution context menus, and deep linking right to their OS.
- **Positive:** Unlocks Node.js OS-level APIs (like encryption, IPC bridging, native networking).
- **Negative:** Substantially increases the footprint and engineering complexity compared to isolated Python/PowerShell scripts, requiring compilation (`npm run electron:start`), preload bridging security, and build-chain maintenance.
