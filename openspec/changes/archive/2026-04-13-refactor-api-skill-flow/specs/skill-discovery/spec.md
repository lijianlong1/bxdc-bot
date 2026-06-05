## MODIFIED Requirements

### Requirement: Dynamic Skill Discovery
The Agent Core SHALL dynamically discover and load available Extended Skills from the SkillGateway at startup or upon request, rather than relying on hardcoded lists.

#### Scenario: Load Skills on Startup
- **WHEN** the Agent Core initializes
- **THEN** it calls the SkillGateway API (`GET /api/skills`) to fetch all skills
- **AND** it registers the skills with `enabled=true` and `type='EXTENSION'` as available tools in its cognitive loop
- **AND** for API Skills it MUST expose only the concise routing summary during initial tool registration, not the full interface description

#### Scenario: Handle Fetch Failure
- **WHEN** the Agent Core fails to fetch skills from SkillGateway during initialization
- **THEN** it logs an error and continues to start with only Built-in skills available

#### Scenario: Parse Skill Configuration
- **WHEN** the Agent Core receives a skill from SkillGateway
- **THEN** it parses the `configuration` JSON to determine the specific tool execution logic (e.g., specific API endpoint or script to run)
- **AND** if the skill is an API Skill, it MUST retain the detailed interface description and parameter format contract for invocation-time use
