## Context

The current memory system in `agent-core` uses a local SQLite database (`memories.db`) managed by `MemoryManager` and `MemoryService`. It performs basic keyword-based search and LLM-based extraction. The goal is to migrate this to an external `mem0` service hosted at `http://39.104.81.41:8001`.

## Goals / Non-Goals

**Goals:**
- Replace local SQLite memory storage with `mem0` service.
- Implement `/msearch` for memory retrieval during agent turns.
- Implement `/madd` for memory storage after agent turns.
- Support long-term and short-term memory through `mem0`'s capabilities.
- Maintain multi-user support by passing `userId` to `mem0`.

**Non-Goals:**
- Migrating existing data from SQLite to `mem0` (start fresh).
- Modifying the `mem0` service itself.
- Changing the frontend memory display (continue using existing API if possible, or update to reflect `mem0` results).

## Decisions

1.  **Service Client**: Create a new `Mem0Client` class or update `MemoryService` to use `axios` for HTTP requests to the `mem0` service.
    - *Rationale*: Decouples the memory logic from the specific storage implementation.
2.  **API Mapping**:
    - `searchMemories` → POST `/msearch` with `sentence`, `userid`, and `topk`.
    - `processTurn` (storage part) → POST `/madd` with `sentencein` (user text), `sentenceout` (assistant text), and `userid`.
3.  **Configuration**: Use `MEM0_URL` in `.env` to store the service base URL.
4.  **Error Handling**: Implement robust error handling for network requests to `mem0`. If the service is down, the agent should still function but without memory context.

## Risks / Trade-offs

- **[Risk] Network Latency** → The agent's response time might increase due to external API calls. *Mitigation*: Use efficient HTTP client settings and consider parallelizing or backgrounding memory storage.
- **[Risk] Service Dependency** → If `mem0` is down, memory features will fail. *Mitigation*: Implement graceful degradation where the agent continues to work without memory.
- **[Risk] Data Privacy** → User information is sent to an external service. *Mitigation*: Ensure the `mem0` service is hosted in a secure environment (it's currently on a private IP).
