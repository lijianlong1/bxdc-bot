## Why

Users currently have no visibility into what skills the agent possesses. Skill management is hidden behind backend APIs. Providing a "Skill Hub" UI will allow users to discover available capabilities, distinguishing between core system functions (Built-in) and custom extensions (Extended), improving usability and transparency.

## What Changes

- Add a "SkillHub" button to the main chat interface (e.g., in the header).
- Implement a "Skill Hub" modal or drawer component.
- Fetch and display a list of skills from the backend.
- Categorize skills into two groups:
  - **Built-in Skills**: Core capabilities like Interface calls (API) and Calculation (Compute).
  - **Extended Skills**: User-defined or stored skills (e.g., Get Time).
- Display skill details: Name and Description.

## Capabilities

### New Capabilities
- `skill-hub-ui`: Frontend interface for viewing and managing (viewing for now) skills.

### Modified Capabilities
- `skill-management`: Update backend or frontend logic to support categorization of skills.

## Impact

- **Frontend**: New `SkillHub` component, modifications to `Layout` or `ChatView`.
- **Backend**: No major schema changes expected, but might need to ensure "Built-in" skills are either seeded in DB or handled via a specific API response if they aren't standard `Skill` entities.
