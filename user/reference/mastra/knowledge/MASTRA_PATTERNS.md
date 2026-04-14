# Patterns for Building AI Agents
> Based on Mastra "Patterns for Building AI Agents" (Vol. 2)

## 1. Agent Configuration Constraints (配置范式)

### Agent Architecture Discovery
- **[Fact]**: Agent development shouldn't start with a "mega-agent", but rather begin with single-purposed subagents that group similar capabilities (e.g., Support Agent vs Sales Agent).
- **[Infer]**: The probability of tool selection errors scales with the number of tools assigned to an agent, thus enforcing an iterative discovery of agent architecture where new capabilities birth new agents behind router logic.
- **[Analogy]**: Building an agent architecture is exactly like human organization design—you group tasks into distinct job roles rather than expecting one employee to do everything.

### Human-in-the-Loop (HITL)
- **[Fact]**: Human involvement can be implemented as deferred execution (background polling), in-the-loop (pausing execution for confirmation), or post-processing (reviewing drafts before delivery).
- **[Infer]**: Since agents do not sleep but humans are slower, a blocking step-by-step HITL design turns humans into immediate bottlenecks. Deferred tool execution is more scalable.

## 2. Context Engineering (上下文工程)

### Context Failure Modes
- **[Fact]**: Beyond raw LLM limitations, agents fail due to "context rot" (degraded attention >100k tokens), "distraction", "poisoning" (hallucinations looped back), "confusion", and "clashes".
- **[Infer]**: Blindly appending previous task execution histories to the context window creates an infinite linear accumulation, necessitating aggressive Context Compression (like token limiters or hierarchical summarization).
- **[Analogy]**: Context engineering is the goldilocks problem—too little information causes starvation, too much noise causes the agent to drown.

### Execution Feedback Loops
- **[Fact]**: Code-executing agents must capture error traces of failed code executions and feed them explicitly back into the context window for self-correction.
- **[Infer]**: Resilience isn't built into the agent loop automatically; the orchestrator must structurally trap exceptions and reshape them as structured input observations for the next reasoning cycle.

## 3. Evaluation & Production Pipeline (评估体系)

### Failure Mode Mapping
- **[Fact]**: The core of moving to production is replacing simple binary error checks with explicit taxonomies of failure modes (e.g., "Rules Misinterpretation" vs "Data Extraction Failure").
- **[Infer]**: Software engineers are poor evaluators of domain-specific agents; evaluations require internal Subject Matter Experts (SMEs) to rate answers to prevent annotation drift against North Star metrics.
- **[Analogy]**: Evals are the performance testing suite for AI; they won't guarantee a single deterministic output but will statistically lock in directional improvements.

## 4. Security by Constraints (安全边界)

### The "Lethal Trifecta" Prompt Injection
- **[Fact]**: An agent is completely compromised if it intersects three permissions: access to private data, exposure to untrusted inputs, and a channel for external exfiltration.
- **[Infer]**: Because LLMs fundamentally blur instructions with data, the most practical defense is breaking the exfiltration leg—heavily sandboxing the execution and intercepting output via Guardrails.
- **[Analogy]**: The Trifecta is a fire triangle—removing oxygen, heat, or fuel stops the blaze, and removing just one of these three agent permissions neutralizes the exploit.
