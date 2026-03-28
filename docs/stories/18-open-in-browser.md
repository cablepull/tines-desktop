# User Story: Native Browser Deep Linking

## Description
**As an** automation builder using the Desktop App  
**I want to** press an "Open natively" button from my Desktop client Canvas View  
**So that** my underlying OS spawns the Tines Web Application and instantly redirects me straight to my selected Story's editing interface in Chrome/Edge.

## Acceptance Criteria
- [ ] Implement an IPC execution bridge inside `electron/main.cjs` granting safe, sandbox-controlled OS terminal execution (e.g. `electron.shell.openExternal()`).
- [ ] Expose this execution vector dynamically into `preload.cjs`.
- [ ] Present an "⭧ Open in Tines Cloud" URI button next to the `StoryView` header, algorithmically forming the URL: `https://[TENANT].tines.com/stories/[ID]`.
