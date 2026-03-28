# Global Action Indexing

## Scenario
As a builder operating within a heavily nested structural tenant (navigating complex access controls, folders, and specific live vs. test execution modes), I expect all my actions within a targeted Story to visibly enumerate on my Canvas regardless of server-side architectural filtering scopes filtering them out dynamically.

## Acceptance Criteria
- Upon instantiating the Story Canvas Router, the Client executes a global `/api/v1/actions?per_page=500` pull, capturing the entire permitted array of action structs.
- The Engine natively iterates the dataset, evaluating `action.story_id` mathematically against the `storyId` defined in the application route.
- Matched records are synchronously stored in the Local React `actions` Context and rendered natively onto the visual graph grid, entirely bypassing the risk of a `422 Unprocessable Content` or empty Server dataset evaluation.
