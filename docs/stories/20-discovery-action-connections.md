# User Story: Discovery - Advanced Story Connectivity

## Description
**As an** automation operator  
**I want to** discover the mathematically correct, OpenAPI-certified process to programmatically build interconnected Action graphs natively inside Tines  
**So that** any "Template" feature we build in the Desktop App relies on standard, supported Tines graph bindings rather than unvalidated scripting assumptions.

## Discovery Steps
- [x] Parse `tines-openapi-derived.yaml` (or the generated TypeScript models).
- [x] Determine if `Actions` are linked exclusively via a `links: []` array, `source_ids`, or an entirely separate Endpoint (e.g. `/api/v1/links`).
- [x] Explore if there exists an overarching `stories/import` JSON structure capable of instantiating an entire tree synchronously.
- [x] Synthesize findings into the internal implementation plan for Phase 4 rendering.

## Discovery Results (2026-03-27)
After aggressively `grep`-ing the `tines-openapi-derived.yaml` base schema used to generate the SDK:
1. There is **no** `/import` endpoint defined within this subset of the API schema.
2. The `source_ids` array **IS** canonically defined on Lines 1183 and 1223 of the OpenAPI Schema.
This fundamentally proves that the original `Build-TinesFlow.ps1` script leverages the exact mathematically supported logic loop for bootstrapping workflows. The React Native Templating Engine will utilize `sourceIds: [num]` heavily!
