# ADR 0003: CORS Bypass via webSecurity Disablement

## Status
Accepted

## Context
When routing `fetch()` calls from the local React origin (`http://localhost:5199`) direct to `https://[tenant].tines.com/api/v1/`, the Chromium network inspector intercepts and immediately fires `CORS (Cross-Origin Resource Sharing) Preflight Failed` errors. Tines natively drops cross-origin DOM requests that don't match their specific SSO ecosystem whitelist. 

## Decision
We elected to disable `webSecurity: false` explicitly inside the `new BrowserWindow({ webPreferences: {} })` Electron instantiation. 

## Consequences
- **Positive:** Allows the React client's `tines-sdk` native JS classes to communicate seamlessly with the Tines Cloud Architecture as if it were a direct un-bound cURL command.
- **Negative:** Inherently risky security posture for a browser container. It effectively allows `fetch` executions routing to any domain on earth regardless of origin policy. 
- **Mitigation:** Since this application only parses user-trusted structural APIs (Tines HQ) and strictly avoids `<iframe>` injections or arbitrary uncontrolled site rendering, the theoretical arbitrary-execution surface is virtually zero.
