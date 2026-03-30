# RCA 15: Authentication Header Conflict (401 Unauthorized)

## 🔍 Incident Summary
After updating the Tines Desktop IDE to `0.1.0-alpha`, all API-bound components (Dashboard, StoryView, ActionsPage) began returning `401 Unauthorized` errors. The application was unable to fetch stories, teams, or credentials, despite having valid and functional API keys derived from `safeStorage`.

## 📉 Root Cause Analysis
The Tines REST API supports multiple authentication headers, primarily `Authorization: Bearer <token>` and `X-User-Token: <token>`. 

Investigation revealed a configuration conflict in how the generated TypeScript SDK was being initialized:
1.  **SDK Internal Logic**: The SDK's `Configuration` object uses the `apiKey` field to populate `X-User-Token`, and the `accessToken` field to populate `Authorization: Bearer`.
2.  **IDE implementation**: The IDE was passing the token as `apiKey`, resulting in `X-User-Token` headers.
3.  **Tenant Enforcement**: Some Tines tenants (or specific API key types like Service Account keys) strictly enforce `Bearer` authentication and reject `X-User-Token`, returning a 401.
4.  **Inconsistency**: Manual `fetch` calls in the IDE (e.g., node execution) were already using `Authorization: Bearer`, leading to a confusing state where some features worked while others failed.

## 🛠️ Resolution
1.  **Standardized Auth**: Refactored all `new Configuration` instances to use the `accessToken` parameter instead of `apiKey`. This forces the SDK to use the `Authorization: Bearer` header globally.
2.  **Dynamic Team Discovery**: Discovered that hardcoded `teamId: 1` was also a potential source of 401/403 errors if the user's key didn't have access to that specific ID. Added a pre-fetch step to `Dashboard.tsx` to resolve the first accessible `teamId` dynamically.

## ✅ Verification Results
- **Dashboard**: `listTeams` and `listStories` now return `200 OK`.
- **StoryView**: Story metadata and actions load successfully with `Bearer` tokens.
- **ActionsPage**: Global action listing is restored.
