## 1. Frontend Setup

- [x] 1.1 Create `SkillHub.vue` component using `TDesign` Drawer.
- [x] 1.2 Add "SkillHub" button to `ChatView.vue` (or `Layout.vue`) header.
- [x] 1.3 Implement state management (e.g., `isSkillHubVisible`) to toggle the drawer.

## 2. Data Integration

- [x] 2.1 Define `BUILT_IN_SKILLS` constant in frontend (API, Compute).
- [x] 2.2 Implement `fetchSkills` function in `useChat` or new `useSkills` composable to call `GET /api/skills`.
- [x] 2.3 Handle loading and error states for skill fetching.

## 3. UI Implementation

- [x] 3.1 Render "Built-in Skills" section in `SkillHub.vue`.
- [x] 3.2 Render "Extended Skills" section in `SkillHub.vue` using fetched data.
- [x] 3.3 Style the skill list items to show name and description clearly.
