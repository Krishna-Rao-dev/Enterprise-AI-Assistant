---
doc_id: REPO-APIGW-001
title: "API Gateway — Routing Rules"
repo: api-gateway
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Overview

The API Gateway is the controlled entry point for client requests to Northwind backend services. It routes requests to upstream services, applies cross-cutting policies, and provides a consistent boundary for authentication, request limits, and observability. This document defines a proposed routing model; verify exact routes and gateway syntax against the repository configuration before deployment.

## Routing Principles

Routes should be explicit, deterministic, and ordered so that specific paths are not shadowed by broad catch-all rules. The gateway should preserve the HTTP method, validate incoming paths, and forward only the headers required by the upstream. Internal service addresses must not be exposed in public responses.

### Example route catalog

| Public path | Upstream service | Methods | Policy |
|---|---|---|---|
| `/api/v1/auth/*` | `auth-service` | GET, POST | Authentication-specific limits |
| `/api/v1/notifications/*` | `notification-svc` | GET, POST, PATCH | Authenticated access |
| `/api/v1/pipeline/*` | `data-pipeline` | GET, POST | Role and payload checks |
| `/health` | Gateway health handler | GET | Minimal response |

The route names are illustrative and should be reconciled with deployed service contracts. Avoid publishing administrative or internal debugging endpoints through the public gateway.

## Request Processing

A typical request passes through the following stages:

1. Parse the request and reject malformed HTTP.
2. Apply connection, header-size, and request-body limits.
3. Match a route using method and normalized path.
4. Apply IP or identity-based rate limits.
5. Authenticate the request when required.
6. Authorize the operation or pass verified identity context to the service.
7. Forward to the selected upstream with a bounded timeout.
8. Normalize safe response headers and record telemetry.

The exact order depends on the gateway product. Security controls must be enforced consistently, and a route must not bypass authentication because a request uses an alternate path encoding or unexpected HTTP method.

## Upstream Configuration

Each upstream should have a stable service identifier, destination, health-check policy, timeout, and retry policy. Prefer service discovery or deployment-managed DNS over hard-coded ephemeral addresses.

Example conceptual configuration:

```yaml
routes:
  - id: auth-api
    path_prefix: /api/v1/auth/
    upstream: auth-service
    timeout_ms: 3000
    require_auth: false
```

This is illustrative YAML, not a claim about the gateway's native configuration format. Authentication is endpoint-specific: login and refresh may be public to the gateway but still require strict service-level validation, while identity and permission endpoints require a valid token.

## Headers and Identity Context

Strip untrusted inbound headers that imitate trusted identity metadata, such as client-supplied internal user IDs or group claims. If the gateway injects verified identity context, it must overwrite those headers after authentication and use a protected network path to the upstream. Do not treat arbitrary `X-User-Id`, `X-Groups`, or similar headers as trustworthy.

Forward a correlation ID or generate one when absent. Validate incoming correlation IDs for length and character set. Avoid forwarding hop-by-hop headers. Do not return upstream stack traces or internal hostnames to clients.

## Timeouts and Retries

Set connection and response timeouts appropriate to each service. Retries should be limited to safe operations and transient errors. Do not automatically retry non-idempotent POST requests unless an idempotency mechanism makes replay safe. Use bounded exponential backoff with jitter for internal retry logic and cap total request time.

| Failure | Recommended gateway behavior |
|---|---|
| No matching route | Return `404` |
| Invalid request | Return `400` |
| Missing or invalid token | Return `401` |
| Authenticated but forbidden | Return `403` |
| Upstream timeout | Return `504` |
| No healthy upstream | Return `503` |
| Rate limit exceeded | Return `429` with retry guidance |

## Security Controls

Require TLS at public boundaries and use TLS or a trusted private network for sensitive upstream traffic. Apply request-size limits, method allowlists, path normalization, and origin restrictions where applicable. CORS is not an authorization mechanism. Keep gateway administrative interfaces private and require strong access controls for configuration changes.

Secrets for upstream credentials, if any, must be stored in a secret manager and represented as `[REDACTED]` in examples and logs. Apply least privilege to gateway service identities.

## Observability

Record route ID, method, status, latency, upstream result, and correlation ID. Avoid logging authorization headers, cookies, request bodies containing credentials, or sensitive query parameters. Dashboards should distinguish client errors from upstream failures and alert on sustained increases in 5xx responses, latency, or rejected requests.

## Change and Validation Procedure

1. Update the route configuration in version control.
2. Run the gateway's configuration validator or unit tests.
3. Test both intended matches and nearby paths that must not match.
4. Verify authentication and authorization behavior.
5. Test timeout, unhealthy upstream, and rate-limit responses.
6. Deploy through the approved change pipeline.
7. Monitor error rate and latency, and roll back if the change causes material regressions.

See [REPO-APIGW-002] for rate-limit policy and [REPO-AUTH-001] for identity endpoints.
