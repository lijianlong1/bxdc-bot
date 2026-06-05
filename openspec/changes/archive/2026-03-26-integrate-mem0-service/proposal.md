## Why

The current memory management system in `agent-core` is based on a local SQLite database with relatively simple extraction and retrieval logic. To provide more robust, intelligent, and scalable long-term and short-term memory for the agent, we need to integrate a dedicated memory service like `mem0`. This will allow for better context awareness, more accurate information retrieval, and a more personalized user experience.

## What Changes

- **Memory Service Integration**: Replace the existing `MemoryService` (SQLite-based) in `agent-core` with a client that interacts with the `mem0` service.
- **API Endpoint Updates**: Update `agent-core` to call the `mem0` service's `/msearch` and `/madd` endpoints as described in the documentation.
- **Data Flow Modification**:
  - During memory retrieval, `agent-core` will call `mem0`'s `/msearch` to get relevant context.
  - After each interaction, `agent-core` will call `mem0`'s `/madd` to store new information.
- **Configuration**: Add configuration for the `mem0` service URL (e.g., `http://39.104.81.41:8001`) in the `.env` file.
- **Deprecation**: Mark the existing SQLite-based memory manager and tables as deprecated or remove them if no longer needed.

## Capabilities

### New Capabilities
- `mem0-integration`: Integration with the external `mem0` memory service for advanced memory management.

### Modified Capabilities
- `memory-management`: Update the existing memory management requirements to use the external service instead of local SQLite.

## Impact

- **Affected Code**: `backend/agent-core/src/mem/memory.service.ts`, `backend/agent-core/src/controller/agent.controller.ts`, and related memory management files.
- **APIs**: New dependency on the `mem0` service API (`/msearch`, `/madd`).
- **Dependencies**: Potential new HTTP client dependency if not already present (e.g., `axios`).
- **Systems**: Transition from local file-based storage (`memories.db`) to a network-based service.
