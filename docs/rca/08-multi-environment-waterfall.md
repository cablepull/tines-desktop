# RCA 08: Multi-Environment Tines Architecture (BUILD vs LIVE)

## The Problem
After bypassing global server restrictions and mapping `/api/v1/actions` natively, the client still returned 0 actions for specific highly-populated Stories (such as Christmas Music flows). 
Despite the Tines canonical Web IDE clearly showing 6+ Action nodes, and our API Key possessing implicit read privileges, standard REST queries resolved identically to empty structural arrays.

## The Investigation
Examining the Tines Web Application routing and modern platform architectures revealed Tines' migration into strict Lifecycle Environments. 
Actions natively exist in three completely segregated runtime environments:
1. **BUILD**: The draft architecture where nodes are edited within the Canvas.
2. **TEST**: The legacy isolated execution test environment.
3. **LIVE**: The actively published worker execution plane.

By requesting `listActions({ storyMode: 'LIVE' })` or globally with no filter, the SDK natively filters against `LIVE` and default deployments, heavily isolating and masking Draft/Build actions created in the web UI that haven't explicitly been "Published"!

## The Solution
We implemented a strict **Environment Waterfall Mechanism**.
The React frontend loops sequentially through explicit query parameters: `story_mode=BUILD`, `story_mode=TEST`, and `story_mode=LIVE`. The moment a valid structural array is returned with elements > 0, the waterfall exits securely and renders the exact context state to the physical grid without throwing structural access blocks!
