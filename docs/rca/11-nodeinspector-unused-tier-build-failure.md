# RCA 11: NodeInspector TS6133 Build Failure — Orphaned Variable Reference

## The Problem
`npm run build` failed with:
```
TS6133: 'tier' is declared but its value is never read.
```
The TypeScript strict-mode compiler (`tsc -b`) flagged an unused local variable in `NodeInspector.tsx`, which Vite's dev server silently tolerated as a warning but `tsc` treats as a hard error.

## Root Cause
The Safety Classification IIFE inside `NodeInspector.tsx` was adapted from `StoryView.tsx`'s `classifyAction()` utility. The original function returned a `tier` string used for lookup in `SAFETY_TIERS`. However, in NodeInspector the IIFE only needed `icon`, `color`, and `label` for inline rendering — making `tier` dead code.

When fixing the initial `TS6133` warning by removing the `let tier` declaration, the `tier = 'safe'` assignments inside each `if` branch became orphaned references to an undeclared variable, cascading into 4x `TS2304: Cannot find name 'tier'` errors.

## The Fix
Removed all `tier = 'x';` assignments from the conditional branches, keeping only the `icon`, `color`, and `label` reassignments that the IIFE actually uses for rendering.

## Lesson
When duplicating classification logic across components, extract it into a shared utility function rather than inlining abbreviated copies. Inline copies drift and create maintenance hazards exactly like this.
