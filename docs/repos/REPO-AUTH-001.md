---
doc_id: REPO-AUTH-001
title: "Auth Service — API Reference"
repo: auth-service
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Overview

The Auth Service centralizes identity verification, session issuance, and authorization context for Northwind applications. This reference describes the intended HTTP contract for application teams. Because no repository source was supplied with this request, endpoint examples are proposed contracts and must be checked against the implementation before production use.

### Conventions

- Base path: `/api/v1`
- Transport: HTTPS in deployed environments
- Payload: JSON encoded as UTF-8
- Access token: Bearer token in the `Authorization` header
- Timestamps: ISO 8601 UTC
- Secrets and tokens: always represented as `[REDACTED]`

## Endpoint Summary

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | Verify credentials and start a session |
| POST | `/api/v1/auth/refresh` | Refresh session | Renew an access token |
| POST | `/api/v1/auth/logout` | Bearer token | End the current session |
| GET | `/api/v1/auth/me` | Bearer token | Return current identity |
| GET | `/api/v1/auth/permissions` | Bearer token | Return effective permissions |
| GET | `/health` | Public or internal | Health probe |

## Login

### POST /api/v1/auth/login

The login endpoint accepts a registered email address and password. Successful authentication returns a short-lived access token and may return a refresh token if persistent sessions are enabled.

Request:

```json
{
  "email": "alex@northwind.example",
  "password": "[REDACTED]"
}
```

Illustrative success response (`200 OK`):

```json
{
  "access_token": "[REDACTED]",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "[REDACTED]"
}
```

The `expires_in` value is an example, not a claim about deployed configuration. Clients must use the actual configured lifetime and should not hard-code it. Invalid credentials should produce a generic `401 Unauthorized` response. Malformed payloads produce `400`, rate-limited requests produce `429`, and unexpected failures produce a sanitized `500`.

## Refresh and Logout

### POST /api/v1/auth/refresh

The refresh endpoint exchanges a valid refresh token for a new access token. If rotation is supported, the response includes the replacement refresh token and the prior token becomes unusable.

```json
{
  "refresh_token": "[REDACTED]"
}
```

Expired, revoked, or invalid refresh tokens should return `401`. Reuse of a rotated token should trigger the configured replay response, which may include revoking the associated token family.

### POST /api/v1/auth/logout

Requires a valid Bearer access token. A successful request returns `204 No Content`. The implementation should revoke the current refresh session. With stateless access tokens, logout may not invalidate an already-issued access token immediately unless the service supports a denylist, token versioning, or introspection.

## Identity and Permissions

### GET /api/v1/auth/me

Returns the authenticated principal, for example:

```json
{
  "user_id": "u_alex",
  "email": "alex@northwind.example",
  "name": "Alex Morgan",
  "groups": ["engineering"],
  "active": true
}
```

Identity fields must come from validated claims or authoritative account data. Never trust a user ID or group list submitted by the caller as proof of identity.

### GET /api/v1/auth/permissions

Returns the permissions applicable to the current principal:

```json
{
  "user_id": "u_alex",
  "permissions": ["profile:read", "documents:read"]
}
```

The permission names are illustrative. Downstream services must enforce authorization at the resource boundary; hiding a button in the frontend is not an access-control mechanism.

## Error Contract

| Status | Meaning | Client action |
|---|---|---|
| 400 | Invalid request | Correct the payload |
| 401 | Missing or invalid authentication | Authenticate or refresh once |
| 403 | Authenticated but not authorized | Do not retry without changed permissions |
| 429 | Rate limit exceeded | Respect `Retry-After` if present |
| 500 | Unexpected service failure | Retry only when safe |
| 503 | Temporarily unavailable | Use bounded backoff |

A standard error object should include a stable machine-readable code and request identifier. Messages must not disclose whether a particular account exists, token contents, stack traces, or database details.

## Security Requirements

Validate signature, issuer, audience, expiry, and allowed signing algorithm for JWTs. Keep signing keys in an approved secret manager and rotate them under a documented procedure. Passwords must use an approved password-hashing algorithm. Never log passwords, complete tokens, or private keys. Apply brute-force controls and rate limits to login and refresh endpoints. If cookies carry refresh sessions, configure `Secure`, `HttpOnly`, and appropriate `SameSite` attributes, and implement CSRF protection where required.

## Integration Checklist

1. Confirm endpoint paths and schemas against the service implementation.
2. Test expired, malformed, revoked, and incorrectly signed tokens.
3. Verify permission checks on every protected backend operation.
4. Confirm generic login failure messages and rate limiting.
5. Ensure logs contain request IDs but no credentials or tokens.
6. Document actual token lifetimes, rotation behavior, and revocation semantics.

See [REPO-AUTH-002] for local setup and [REPO-APIGW-001] for gateway routing.
