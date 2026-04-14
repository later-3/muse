# Principles of Building AI Agents
> Based on Mastra "Principles of Building AI Agents" (2nd Edition)

## 1. Prompting & LLM Fundamentals (大模型与提示词)

### Reasoning Models (e.g., o1)
- **[Fact]**: Extended reasoning models obscure their intermediate steps within an internal chain-of-thought, returning comprehensive answers but at much higher latency.
- **[Infer]**: These models should be treated as "report generators" instead of chat interfaces, yielding best results when front-loaded with massive contextual prompts (e.g., few-shot learning).
- **[Analogy]**: Traditional LLMs are like quick responders on an intercom; reasoning models are like deep-research analysts whom you assign a task and wait hours for the final dossier.

## 2. Core Agent Protocols (核心代理协议)

### Model Context Protocol (MCP)
- **[Fact]**: MCP provides a standardized client-server interface across transport layers for exposing remote functions to LLM tool-calling endpoints.
- **[Infer]**: MCP eliminates the n-by-n integration problem, decoupling the model orchestration (clients like Cursor/Windsurf) from the tool implementation environments.
- **[Analogy]**: MCP is the "USB-C port for AI"—a universal connector letting agents plug into any system irrespective of where it was built.

### Agent Memory Processors
- **[Fact]**: Besides long-term document vector stores, frameworks require deterministic "working memory" processors, tracking Sliding Windows, Token Limiters, and Tool Call Filters.
- **[Infer]**: Tool calls inherently bloat conversational context. Using a `ToolCallFilter` processor prevents useless historical JSON payloads from suffocating the active reasoning layer.

## 3. Architecture Structures (架构范式)

### RAG vs Agentic RAG
- **[Fact]**: Standard RAG embeds/retrieves static text fragments via Vector DBs (e.g., pgvector), whereas Agentic RAG exposes domain-specific functional APIs (like calculators or SQL query generators) as tools.
- **[Infer]**: If precision is paramount, Agentic RAG computes exact data directly, at the cost of significantly higher orchestration engineering effort than semantic chunking.
- **[Analogy]**: Standard RAG is searching an encyclopedia; Agentic RAG is giving the agent an Excel spreadsheet and telling it how to run macros.

### Graph-Based Workflows
- **[Fact]**: Workflows freeze agent tasks into directed graphs with branching, merging, suspension (callbacks), and deterministic condition nodes.
- **[Infer]**: Absolute autonomy is brittle; when tasks are heavily deterministic, graph orchestrations bound the LLM to simple, isolated node evaluations, drastically reducing overall failure probabilities.

## 4. Multi-Agent Systems & Telemetry (多智能体与观测)

### Orchestration Hierarchies
- **[Fact]**: Multi-agent setups group unique system prompts, distinct memory profiles, and separate tools inside specialized operational silos, often coordinated by a "Manager" or "Supervisor" agent.
- **[Infer]**: Exposing complex sub-workflows strictly as individual tool endpoints to the primary agent abstracts complexity, maintaining single responsibility logic.
- **[Analogy]**: A single AI agent is an independent freelancer; a multi-agent system is a fully structured corporate department with specialized reporting lines.

### Observability and Evals
- **[Fact]**: Evaluating subjective textual outputs requires distinct metrics for Faithfulness (accuracy against context) and Hallucination, monitored via standardized OpenTelemetry tracing.
- **[Infer]**: Non-deterministic flows ensure eventual failure. Detailed input/output step tracing is a basic reliability requirement, not an advanced convenience.
