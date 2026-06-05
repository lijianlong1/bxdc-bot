# skill-confirmation-react-redesign — implementation notes

## 1.1 LangGraph interrupt POC (memory checkpoint)

Sequence (aligned with `@langchain/langgraph@1.2`):

1. `createReactAgent({ ..., checkpointer: new MemorySaver() })`.
2. `graph.stream({ messages }, { configurable: { thread_id: "<session>" } })`.
3. Inside a tool: `interrupt<Payload, { confirmed: boolean }>({ ...metadata })` throws `GraphInterrupt` until resumed.
4. Stream emits updates containing `__interrupt__` (see `INTERRUPT` in `constants`).
5. Resume: `graph.stream(new Command({ resume: { confirmed: true } }), { configurable: { thread_id: "<same>" } })`.
6. Same tool invocation resumes; `interrupt()` returns `{ confirmed }` without throwing.

## 1.2 Audit (legacy vs spec)

| Issue | Resolution |
|-------|------------|
| Tool returned `CONFIRMATION_REQUIRED` JSON → LLM asked user to type confirm | Replaced with `interrupt()` so no ToolMessage with that JSON before resume. |
| Controller `drainAsyncIterator` + `invokeExtendedSkillWithConfirmed` | Removed; resume uses `Command` on the same compiled graph. |
| SSH returned `instruction` + JSON confirmation | SSH dangerous path now uses `interrupt()`; description updated. |
| `sessionId` | Gateway sets `context.sessionId` to task id; frontend `activeSessionId` matches. |

## 6.2 Archive

Run the OpenSpec archive workflow when ready to merge specs into `openspec/specs/`.
