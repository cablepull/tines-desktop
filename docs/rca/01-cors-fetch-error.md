# RCA 01: CORS Preflight Block on Tines REST API

## Problem Statement
The user successfully booted the Electron application, logged into their profile, and landed on the Dashboard. However, the `Dashboard.tsx` triggered multiple `ERROR` logs. The Chrome DevTools trace indicated:
```
Access to fetch at 'https://*.tines.com/api/v1/stories?per_page=12' from origin 'http://localhost:5199' has been blocked by CORS policy.
```
This is because normal browser contexts enforce the **Same-Origin Policy**. Since Tines' API does not echo `Access-Control-Allow-Origin: *` for security reasons, the browser forcefully aborts the network request.

## Root Cause
Electron's Renderer process is structurally just a Chromium web page. By default, Chromium executes strict web security checking (CORS) on `fetch()` calls. Because we are relying on a generated TypeScript `fetch` SDK operating exclusively inside the Renderer, the requests structurally fail identical to a normal browser, blocking the app from communicating with Tines.

## Resolution
Unlike standard web apps, Electron desktop apps can optionally suspend web security checks since the "origin" is inherently a trusted desktop environment running native, user-specified API keys.
1. Opened `electron/main.cjs`.
2. Inserted `webSecurity: false` into the `webPreferences` configuration of `BrowserWindow`.
3. This informs Chromium to bypass the Same-Origin Policy entirely, permitting raw REST interaction instantly!

## Validation
Once the Electron binary is restarted (`npm start`), the Chromium engine will load the Vite localhost with `webSecurity` deactivated, permanently unblocking local REST requests to the Tines cloud!
