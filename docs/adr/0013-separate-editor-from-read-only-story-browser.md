# ADR 0013: Separate Editor From Read-Only Story Browser

## Status
Accepted

## Context
The application had grown a mixed model where inspection, debugging, and mutation controls lived together in the same story surfaces. That made normal browsing risky: a user opening a story to inspect evidence could still create stories, create actions, drag nodes, delete nodes, reconnect edges, dry run actions, or toggle remote server state from the same general path.

The debugger PRDs push the product toward evidence-first investigation. That requires a default experience where opening a story is safe, while still preserving a deliberate place for builder workflows that mutate the tenant.

## Decision
We will separate the application into two intentional product surfaces:

1. `Dashboard` and the standard story canvas are read-only.
   - They support browsing, debugging, ledger inspection, export, and local investigation persistence.
   - They do not expose remote mutation controls.
2. `Editor` is the only in-app surface allowed to mutate the remote tenant.
   - Story creation, scaffold/template generation, editable canvas actions, and other remote mutation affordances live there.
   - The `Editor` surface carries an explicit warning that it is not fully implemented and can change tenant state.
3. Settings remains configuration-oriented.
   - Experimental mutation tools are moved out of Settings and into the Editor surface.

## Consequences
- Positive: investigation and debugging are safer by default.
- Positive: the UI better matches the product boundary between evidence review and builder workflows.
- Positive: mutation-related warnings become clearer because they are concentrated in one place.
- Negative: some earlier story docs and affordances must now be reinterpreted as `Editor`-only behavior.
- Negative: users have one extra navigation step before making changes to a story.
