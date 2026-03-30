# RCA 13: Windows White Screen of Death (WSoD) — Asset Path Protocol Error

## The Problem
The application successfully launched on Windows 11 but displayed a complete white screen with no React components rendering.

## Root Cause
The `vite.config.ts` was missing the `base` property, causing Vite to default to absolute paths for assets (e.g., `<script src="/assets/index.js">`). 

In a production Electron build, the application is loaded via the `file://` protocol. Absolute paths resolve to the root of the user's filesystem (e.g., `C:\assets\index.js`), which does not contain the application's compiled assets. This leads to 404 errors for all JS and CSS bundles, leaving the DOM empty.

## The Fix
Set `base: './'` in `vite.config.ts`. This forces Vite to generate relative asset paths (e.g., `<script src="./assets/index.js">`), which correctly resolve relative to the `index.html` file within the Electron ASAR bundle regardless of the install location.

## Lesson
Always explicitly set a relative base path in Vite when targeting Electron production builds to ensure compatibility with the `file://` protocol across different operating systems.
