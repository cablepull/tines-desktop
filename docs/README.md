# Tines Desktop Docs

Tines Desktop is a local Electron application for investigating, browsing, and selectively editing Tines stories.

**Navigation**

- [Project Home](./index.html)
- [User Guide](./guides/app-user-guide.md)
- [Repository README](../README.md)
- [Debugger RCA](./rca/16-debugger-log-parity-and-supported-health-signals.md)

It is designed to be a safer operational companion to the Tines web UI, with a strong emphasis on:

- read-only story browsing
- visual and table-based debugging
- forensic lookup by Event ID and Story Run GUID
- local investigation persistence
- explicit separation between browsing and mutation-capable editing

## What The App Does

The current app supports these core workflows:

- **Connection profiles**
  - Save tenant profiles locally and reconnect quickly
  - Profile data is stored in an encrypted-at-rest file when Electron `safeStorage` is available on the host OS

- **Dashboard**
  - Browse stories in a read-only flow
  - Start forensic lookup without opening the Tines web UI first

- **Story Canvas**
  - Open a story in a read-only canvas for visual inspection
  - Use local-only layout and navigation controls like auto-layout, zoom, focus, search, export, and grid overlay

- **Safety Map**
  - View safety-oriented classification over the graph
  - Review blast radius and trace where problematic data may be propagated, re-emitted, or turned into side effects

- **Debug Trace**
  - Inspect run-scoped or all-runs execution context visually
  - Combine execution evidence with supported live health signals

- **Story Audit Ledger**
  - Review execution evidence in a row-oriented forensic table
  - Anchor debugging with concrete event IDs and run GUIDs

- **Forensic Lookup**
  - Start from an old Event ID or Story Run GUID
  - Resolve story, action, run context, and downloadable artifacts

- **Investigations**
  - Save local investigative sessions with summary, findings, screenshot, and evidence artifacts
  - Reopen, export, duplicate, and manage saved investigations

- **Editor**
  - Explicitly separated mutation-capable surface
  - Present, but not yet mature enough to recommend as a primary editing workflow

## Current Product Shape

The app intentionally separates two modes of use:

- **Read-only investigation**
  - Dashboard
  - Story Canvas
  - Safety Map
  - Debug Trace
  - Story Audit Ledger
  - Forensic Lookup
  - Investigations

- **Editing**
  - Editor

This split is deliberate. The normal story-browsing path is meant to be safe for inspection and investigation. Editing is isolated so mutation intent is explicit.

## Important Limitations

### Debug/log parity with Tines

The desktop debugger does **not** currently guarantee exact parity with every failure detail shown in the Tines web UI.

What works well:

- reconstructing execution history from events, runs, and cached local evidence
- showing supported story/action health signals from REST live-activity fields
- preserving local investigative context and artifacts

Current limitation:

- some Tines action-log detail visible in the web UI is not consistently exposed through the supported desktop API path
- in testing, supported REST action logs could return empty arrays for actions where the Tines UI still showed `401`, `404`, or `500` failures

This means:

- Debug Trace is strongest at showing what executed and which supported health signals look suspicious
- when exact native log wording matters, the Tines web UI may still expose detail the desktop app cannot currently reproduce

See:

- [RCA 16](./rca/16-debugger-log-parity-and-supported-health-signals.md)

### Connection profile encryption caveat

Saved profile data is written using Electron `safeStorage` when the OS-backed encryption service is available.

In normal desktop use, this should usually be available on:

- macOS
- Windows
- by inference from Electron's Windows DPAPI behavior, normal Windows Server installs as well

The more likely edge cases are:

- unusual Linux environments
- stripped-down VMs
- containers
- systems without a working desktop secret store

If `safeStorage` is unavailable, the current implementation falls back to storing serialized profile data without OS-backed encryption.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run start
```

The Electron shell starts with remote debugging enabled in development on `REMOTE_DEBUG_PORT` (default `9223`).

Build the renderer:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Electron MCP / UI Automation

The project supports driving the running Electron app for screenshots, DOM inspection, and workflow capture.

Start the MCP server in a second terminal:

```bash
npm run mcp:start
```

Recommended environment:

```bash
SECURITY_LEVEL=balanced
REMOTE_DEBUG_PORT=9223
```

Typical local flow:

1. Run `npm run start`
2. Run `npm run mcp:start`
3. Use Electron MCP tools or the local capture scripts against the live desktop window

## Guides

The main end-user walkthrough is:

- [App User Guide](./guides/app-user-guide.md)

That guide includes:

- connection profiles
- dashboard workflow
- forensic lookup
- story canvas
- organize chart / auto-layout
- safety map
- debug trace
- story audit ledger
- investigations
- editor
- settings

## Packaging

The repo includes Electron Builder configuration for macOS and Windows release builds.

Available scripts:

```bash
npm run electron:build:mac
npm run electron:build:win
```

Current package version:

- `0.1.1-alpha`

## Repository Notes

- This project uses DuckDB for local evidence and investigation persistence.
- The local Tines SDK dependency is linked from `../tines-sdk-js`.
- Generated report output like `playwright-report/`, `test-results/`, `blob-report/`, `coverage/`, and local scratch `tmp/` are ignored.
