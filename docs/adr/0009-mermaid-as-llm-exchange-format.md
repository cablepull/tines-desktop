# ADR 0009: Mermaid (.mmd) as LLM-Exchange Format

## Status
Accepted

## Context
Providing story context to an AI agent (LLM) currently requires either dumping raw JSON (which is verbose and hard for LLMs to visualize) or taking screenshots (which lacks structured metadata). A text-based, compact, and structured representation is needed for "LLM-in-the-loop" automation.

## Decision
We decided to adopt **Mermaid.js (.mmd)** as the primary text-based exchange format for the Tines Desktop IDE.

1.  **Syntactic Portability**: Mermaid is a standard markdown-compatible syntax (`graph TD`) that LLMs natively understand and can generate.
2.  **Metadata Inclusion**: The serializer includes node IDs, human names, agent types, and safety-tier styling within the graph definition.
3.  **Visualization-Ready**: The exported `.mmd` string can be pasted into any markdown tool (GitHub, Notion, Obsidian) to instantly render the logic graph.
4.  **Structural Reasoning**: Using `A --> B` syntax allows the LLM to easily reason about the graph's topology, loops, and bottlenecks during a chat session.

## Consequences
- **Positive**: Instant "Story Context" sharing between the IDE and AI agents.
- **Positive**: Drastically reduced token consumption compared to raw JSON dumps.
- **Negative**: Limited styling options in Mermaid may not capture every specific Tines visual nuance.
