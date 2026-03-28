# User Story: Secure Key Storage

## Description
**As a** security-conscious developer  
**I want to** store my API keys securely using operating-system-level encryption  
**So that** my credentials cannot be easily compromised or sifted through by malicious software reading plaintext files (like standard `localStorage`).

## Acceptance Criteria
- [ ] Drop `localStorage` implementation for credential storage in the frontend completely.
- [ ] Rely on Electron's Native `safeStorage` module inside the Main Process to asynchronously encrypt/decrypt keys using the operating system's native keychain.
- [ ] Bridge communication safely to the Vue/React client over isolated IPC channels (`preload.cjs`).
