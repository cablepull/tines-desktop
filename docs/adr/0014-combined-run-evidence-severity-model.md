# ADR 0014: Combined Run Evidence Severity Model

## Status
Accepted

## Context
The debugger originally treated story events as the primary source of truth for run severity while counting action logs separately. In practice, Tines often surfaces the more meaningful failure signal in action logs, even when the corresponding event row remains `info` or otherwise looks healthy.

This caused misleading debug-bar tallies, undercounted failing actions, and inconsistent severity between the debug bar and the Story Audit Ledger.

## Decision
We will derive debugger severity from combined run evidence:

1. Events remain a core signal for execution path and payload context.
2. Action logs are treated as first-class severity evidence, not as a secondary side counter.
3. Severity is normalized into:
   - `Flow-blocking`
   - `External issue`
   - `Advisory`
   - `Healthy`
4. The debug bar, node health, and ledger classifications should use the same shared normalization rules.

## Consequences
- Positive: debugger tallies better match what users see in Tines when failures are only obvious in logs.
- Positive: downstream HTTP problems can be separated from local runtime breaks more consistently.
- Positive: ledger and debug-bar severity become easier to trust because they share a model.
- Negative: severity remains heuristic in cases where Tines does not expose an explicit failure type.
