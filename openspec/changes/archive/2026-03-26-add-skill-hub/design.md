## Context

The agent has powerful capabilities (skills) like SSH execution, API calls, and computation, but these are invisible to the end user. Users need a way to see what the agent can do. The backend already supports skill management via `SkillController`, but there is no frontend interface for it.

## Goals / Non-Goals

**Goals:**
- Create a `SkillHub` frontend component to list skills.
- Integrate a "SkillHub" button into the main chat interface.
- Fetch custom "Extended Skills" from the backend API.
- Display "Built-in Skills" (API, Compute) alongside extended skills.
- Show skill names and descriptions.

**Non-Goals:**
- Skill creation/editing/deletion from the UI (Read-only for now).
- Direct execution of skills from the Hub (Discovery only).

## Decisions

### Frontend Architecture
- **Component**: Use a `TDesign` `Drawer` component for the Skill Hub. It offers ample space for a list and doesn't block the entire screen like a modal might.
- **State Management**: Use a simple reactive state (e.g., `isSkillHubOpen`) in `useChat` or a new composable `useSkillHub` to control visibility.
- **Data Source**:
  - **Extended Skills**: Fetch from `GET /api/skills`.
  - **Built-in Skills**: Define as a constant `BUILT_IN_SKILLS` in the frontend code, as these represent core system capabilities not necessarily stored in the database.

### UI/UX
- **Entry Point**: A button (icon + text?) in the `Layout` header or `ChatView` action bar.
- **Layout**: A list or grid view within the Drawer. Grouped by category ("Built-in" vs "Extended").

## Risks / Trade-offs

- **Risk**: Hardcoded built-in skills might become outdated if backend capabilities change.
  - **Mitigation**: Keep the built-in list high-level (e.g., "API Proxy", "Computation Engine").
- **Risk**: Fetching skills might fail.
  - **Mitigation**: Handle API errors gracefully and still show built-in skills.
