# ADR 0002: OS-Level Credential Encryption via safeStorage

## Status
Accepted

## Context
The application supports multi-tenancy profiling, allowing Security Engineers to cycle between dozens of client Tines tenants. Saving high-privilege Tines API Tokens natively in `localStorage` inside the React Application leaves credentials entirely unencrypted on the operator's disk, exposing them to superficial malware-scraping operations.

## Decision
We decided to securely proxy credential operations out of the `BrowserWindow` DOM into Electron's Node `main.cjs` process over `ipcMain`. All profiles are explicitly encrypted using Electron's OS-native `safeStorage` (leveraging macOS Keychain, Windows Credential Manager, or Linux Secret Service) before being explicitly dumped to the `.config/tines-desktop/profiles.json` disk store.

## Consequences
- **Positive:** Massively elevates application security posture. At-rest credentials are cryptographic blobs fundamentally bound to the Operator's OS user-login.
- **Positive:** Aligns with standard Desktop Enterprise compliance models.
- **Negative:** Requires strict IPC (Inter-Process Communication) context switching in React to load the App, slightly complicating synchronous state hydration.
