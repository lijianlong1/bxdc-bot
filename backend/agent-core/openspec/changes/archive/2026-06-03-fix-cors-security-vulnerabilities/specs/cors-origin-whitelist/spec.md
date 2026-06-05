## ADDED Requirements

### Requirement: CORS origin whitelist validation
The server SHALL accept cross-origin requests only from origins that match the configured whitelist in the `CORS_ALLOWED_ORIGINS` environment variable, and SHALL reject all other cross-origin requests with no `Access-Control-Allow-Origin` header.

#### Scenario: Configured origin is allowed
- **WHEN** a cross-origin request is received with `Origin: http://localhost:8080`
- **AND** `CORS_ALLOWED_ORIGINS` is set to `http://localhost:8080,http://127.0.0.1:8080`
- **THEN** the response SHALL include `Access-Control-Allow-Origin: http://localhost:8080`

#### Scenario: Unconfigured origin is rejected
- **WHEN** a cross-origin request is received with `Origin: https://evil.example.com`
- **AND** `CORS_ALLOWED_ORIGINS` does not include `https://evil.example.com`
- **THEN** the response SHALL NOT include an `Access-Control-Allow-Origin` header

#### Scenario: Missing Origin header (same-origin request)
- **WHEN** a request is received without an `Origin` header (same-origin or server-to-server)
- **THEN** the response SHALL NOT include CORS headers but SHALL be processed normally

#### Scenario: Default origins when env var is unset
- **WHEN** `CORS_ALLOWED_ORIGINS` is not set in environment
- **THEN** the server SHALL default to allowing `http://localhost:8080` and `http://127.0.0.1:8080`

### Requirement: Vary Origin header
The server SHALL include `Vary: Origin` in all CORS preflight (OPTIONS) response headers to prevent caching proxies from serving cached CORS responses to different origins.

#### Scenario: Preflight response includes Vary
- **WHEN** an OPTIONS preflight request is received with a valid `Origin` header
- **THEN** the response SHALL include `Vary: Origin`

### Requirement: Origin not blindly reflected
The server MUST NOT use the `Origin` request header value directly as the `Access-Control-Allow-Origin` response header without validation. The origin value SHALL only be echoed when it matches the configured whitelist.

#### Scenario: Unlisted origin not echoed
- **WHEN** a cross-origin request is received with `Origin: https://attacker.example.com`
- **AND** `CORS_ALLOWED_ORIGINS` is set to `http://localhost:8080`
- **THEN** the response SHALL NOT echo `https://attacker.example.com` in `Access-Control-Allow-Origin`
