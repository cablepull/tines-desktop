# User Story: Fix Electron Blank Screen (Vite CJS Interop)

## Description
**As a** desktop UI developer  
**I want to** ensure locally linked dependencies (like `tines-sdk-js`) are pre-bundled by Vite  
**So that** the browser doesn't throw a CommonJS `exports is not defined` error, turning my Electron app into a white blank screen!

## Acceptance Criteria
- [x] Investigate the root cause of the silent GUI failure.
- [x] Identify that Vite ignores `file:` symlinked local dependencies heavily populated with `module: "CommonJS"`, sending raw `require()` logic straight to the browser.
- [x] Patch `vite.config.ts` by appending `tines-sdk` to the `optimizeDeps.include` array, compelling Vite's esbuild to convert it into an ES Module chunk the app can consume seamlessly.
- [x] Ensure Vite live-reloads and the Application's UI (App.tsx and Login.tsx) successfully render.
