# skill-kind-normalization Specification

## MODIFIED Requirements

### Requirement: Canonical Skill Kind Model

The system SHALL treat skill `kind` as a base execution type only, and SHALL support `api`, `ssh`, and `template` as canonical values for CONFIG-mode skills.

#### Scenario: Validate canonical kinds

- **WHEN** a CONFIG-mode skill is created or updated with `kind=api`, `kind=ssh`, or `kind=template`
- **THEN** the validation passes if other required fields for that kind are valid

#### Scenario: Reject non-canonical kinds for new writes

- **WHEN** a CONFIG-mode skill is created with `kind=time` or `kind=monitor` (or any value other than `api`, `ssh`, or `template`) outside of documented legacy read paths
- **THEN** the system rejects the write with a validation error indicating non-canonical kind usage
