---
doc_id: REPO-AUTH-002
title: "Auth Service — Setup Guide"
repo: auth-service
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Purpose and Scope

This guide describes a repeatable local development workflow for the Auth Service. It is a proposed setup reference because the actual repository manifest and runtime configuration were not provided. Verify package scripts, dependency versions, and environment variable names against the checked-out code before using these commands.

## Prerequisites

| Dependency | Expected purpose | Verification |
|---|---|---|
| Git | Retrieve source code | `git --version` |
| Supported runtime | Run the service | Check repository manifest |
| Package manager | Install dependencies | Check lockfile and README |
| PostgreSQL or configured store | Persist accounts and sessions | Confirm environment config |
| Secret manager or local env file | Supply development secrets | Never commit secrets |

Use the runtime version specified by `.nvmrc`, `package.json`, `.tool-versions`, a container image, or the repository's equivalent version file. Avoid installing a newer major version without validating compatibility.

## Obtain and Inspect the Repository

Clone the repository from the approved Northwind source host, then enter the project directory:

```bash
git clone <approved-repository-url>
cd auth-service
git status --short
```

Review `README.md`, the package manifest, lockfile, migration directory, and test scripts before running setup. Do not paste private repository URLs or credentials into public issue trackers. Confirm that the current branch is appropriate for development and that no unexpected local modifications will be overwritten.

## Configuration

Create a local environment file only if the project supports it. Keep it untracked and restrict its filesystem permissions. Typical configuration concepts include:

| Key | Purpose | Example policy |
|---|---|---|
| `PORT` | HTTP listen port | Use a free local port |
| `DATABASE_URL` | Database connection | Local non-production database |
| `JWT_ISSUER` | Expected token issuer | Match local service identity |
| `JWT_AUDIENCE` | Intended token audience | Match local clients |
| `JWT_SECRET` or key reference | Token signing material | `[REDACTED]`, never commit |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime | Use a short development lifetime |
| `LOG_LEVEL` | Logging verbosity | `debug` only locally |

These keys are illustrative. Use only names supported by the code. Prefer asymmetric signing keys or a managed secret reference where the architecture requires them. Never use production credentials for local testing.

## Install and Start

For a Node.js service using npm, the likely workflow is:

```bash
npm ci
npm run
```

Inspect the scripts printed by the second command, then run the repository's documented development script, commonly `npm run dev` or `npm start`. Do not assume a script exists just because it is common. If the project uses Docker Compose, follow its checked-in compose file and ensure ports do not conflict with other local services.

Apply database migrations using the project-defined migration command. Do not reset or seed a shared database. Seed only an isolated local database with synthetic test accounts and non-sensitive sample data.

## Validate the Setup

1. Start the configured database or test double.
2. Run linting and unit tests using the documented scripts.
3. Start the service and call `GET /health`.
4. Exercise a valid and invalid login using test-only credentials.
5. Confirm that a protected endpoint rejects a missing token.
6. Confirm that logs do not include passwords or complete tokens.
7. Stop the process and check for leaked child processes or occupied ports.

Example health check:

```bash
curl -i http://localhost:3000/health
```

Replace the port with the configured local value. A successful health response should be small and must not reveal secrets or internal infrastructure metadata.

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Port already in use | Another process owns the port | Select a free port or stop the intended local process |
| Database connection refused | Database is stopped or URL is wrong | Verify service status and local connection settings |
| Invalid signing key | Key format or algorithm mismatch | Regenerate local-only key material using approved tooling |
| Migration failure | Schema drift or wrong database | Confirm target database before retrying |
| Tests fail only locally | Runtime or dependency mismatch | Compare runtime and lockfile with repository requirements |

## Safe Development Practices

Keep `.env` files, certificates, private keys, database dumps, and local logs out of version control. Review `git status` before committing. Use synthetic data rather than employee records. Never disable authentication checks to make tests pass; use test fixtures and dependency injection instead. Ensure CI runs linting, unit tests, and security checks on every pull request.

## Before Opening a Pull Request

Document new environment variables, migrations, endpoints, and changes to token semantics. Add tests for both allowed and denied access. Confirm that configuration defaults are safe, errors are sanitized, and all secrets are externalized. Ask the service owner to validate this guide against the actual repository before marking it authoritative.

See [REPO-AUTH-001] for the API contract.
