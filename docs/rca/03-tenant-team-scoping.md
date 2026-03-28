# Root Cause Analysis: Story Creation 404 "Not Found"

## Symptoms
Creating a new blank workspace Story or scaffolding the "AI Template Workflow" natively invoked the Typescript SDK, but the Tines cloud responded with a strict `HTTP 404 Not Found` error mapped against `POST /api/v1/stories`.

## Root Cause
The `tines-sdk-js` payload bindings implicitly require context scoping (`teamId`) to successfully link resources into the correct authorization envelope. Initially, the IDE implementation hardcoded `teamId: 1`, mirroring the explicit legacy PowerShell `Build-TinesFlow.ps1` script parameters. 
However, each Tines Tenant provisions explicit unique database Tenant-scoped integers. Because the user's specific tenant (`floral-field-3735`) does not have a valid authorization map linked to `teamId: 1` relative to their API Key, the Tines REST security perimeter rejected the internal POST action under a `404` veil.

## Resolution
We aggressively stripped all static integer mapping out of the React engine (`Dashboard.tsx`) and injected a dynamic contextual Tenant polling sequence:
1. Prior to story generation, the system triggers a lightweight `GET /api/v1/teams` REST mapping against the user's encrypted API Key.
2. The application intercepts the authorized schema array, and forcefully extracts the precise live `[0].id` associated with the active credential.
3. This dynamic `teamId` integer is bundled and correctly pushed into `storiesApi.createStory({ storyCreateRequest: { teamId, name } })`.

## Extracted Development Principles
We must never hard-map `team_id: 1` or explicitly bounded integers on any API creation workflows mapping against remote Tines tenants. Tenant server lifecycles iterate internal Teams and Story counters asynchronously, which will guarantee environment divergence and un-authorized schema breakage.
