## 1. Backend: Server Ledger Enhancement

- [x] 1.1 Update `ServerLedger` entity to include `name` field with unique constraint
- [x] 1.2 Update `ServerLedgerRepository` to find by name and user
- [x] 1.3 Update `ServerLedgerService` and `ServerLedgerController` to handle `name` in CRUD operations
- [x] 1.4 Add `requiresConfirmation` field to `Skill` entity and update `SkillService`/`SkillController`

## 2. Backend: Skill Confirmation Logic

- [x] 2.1 Update `SSHExecutorService` to support confirmation check (though mostly handled in Agent)
- [x] 2.2 Implement `ServerLookupService` or add method to `ServerLedgerService` to resolve name to IP
- [x] 2.3 Expose `server-lookup` endpoint in `SkillController`

## 3. Agent Core: Skill Confirmation & Lookup

- [x] 3.1 Implement `JavaServerLookupTool` in `java-skills.ts`
- [x] 3.2 Update `JavaSshTool` to handle `requiresConfirmation` logic and `confirmed` parameter
- [x] 3.3 Update `AgentFactory` to include `JavaServerLookupTool`
- [x] 3.4 Update System Prompt to handle `CONFIRMATION_REQUIRED` response and server lookup instructions

## 4. Frontend: UI Updates

- [x] 4.1 Update `useServerLedger` composable to support `name` field
- [x] 4.2 Update `ServerLedger.vue` component to allow editing/viewing server names
- [x] 4.3 Update `MessageList.vue` or create a new component to render confirmation requests
- [x] 4.4 Implement confirmation action handler (sending "Yes/No" back to chat)

## 5. Verification

- [x] 5.1 Verify server creation with name
- [x] 5.2 Verify server lookup by name via Agent
- [x] 5.3 Verify SSH execution triggers confirmation prompt
- [x] 5.4 Verify SSH execution proceeds after confirmation
