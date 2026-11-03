---
doc_id: REPO-APIGW-002
title: "API Gateway — Rate Limits"
repo: api-gateway
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Purpose

Rate limiting protects Northwind services from accidental overload, abusive automation, credential stuffing, and uneven traffic bursts. This guide defines a proposed policy framework for gateway owners. Actual thresholds must be approved using capacity tests and business requirements before being applied to production.

## Policy Model

Rate limits should be applied at multiple levels where appropriate: source IP, authenticated principal, API key or client identity, and expensive route. IP-only controls are insufficient for authenticated APIs because many legitimate users may share a NAT address. Identity-only controls are insufficient for unauthenticated login endpoints and distributed abuse.

### Example policy matrix

| Route category | Example limit | Burst behavior | Notes |
|---|---:|---|---|
| Login | 10 attempts/minute per account and source | Small burst | Add progressive abuse controls |
| Token refresh | 30 requests/minute per session | Low burst | Prevent refresh loops |
| Read APIs | 120 requests/minute per user | Moderate burst | Tune to client usage |
| Expensive reports | 10 requests/minute per user | Minimal burst | Protect CPU and database |
| Health checks | Internal policy-specific | Controlled | Do not let probes starve user traffic |

These values are starting examples only, not approved production thresholds. Validate them with load tests and service-owner review. Authentication throttling should avoid permanently locking accounts based only on attacker-controlled requests.

## Algorithms

A token bucket allows a configured burst while enforcing a long-term average rate. Each bucket has a capacity and refill rate. A request consumes a token; if no token is available, the gateway rejects or delays the request. A sliding-window counter provides a more intuitive per-window limit but may allow edge effects depending on implementation. A fixed window is simpler but can permit bursts at window boundaries.

Choose the algorithm based on required fairness, burst tolerance, storage cost, and consistency across gateway instances. Distributed deployments need shared state or a deliberate per-instance approximation. If Redis backs the limiter, configure connection timeouts, memory policy, key expiry, and failure behavior.

## Key Design

Build rate-limit keys from normalized route identity and a trusted caller identifier. For authenticated requests, prefer a stable principal or client ID. For public authentication routes, combine source-level controls with privacy-conscious account identifiers. Avoid storing raw email addresses or tokens in limiter keys; use a keyed hash where necessary.

Example conceptual key:

```text
rl:v1:{route_id}:{principal_hash}
```

Keys should have bounded cardinality and an expiration policy. Never use a caller-supplied identity header unless it has been validated or overwritten by a trusted gateway component.

## Client Response

When a limit is exceeded, return `429 Too Many Requests`. Where supported, include `Retry-After` and standard rate-limit metadata such as remaining capacity and reset time. Avoid exposing internal bucket keys or other users' usage.

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again later.",
    "request_id": "req_example_002"
  }
}
```

Clients should use bounded exponential backoff with jitter and respect `Retry-After`. They should not retry immediately in a tight loop. For non-idempotent requests, clients should use idempotency keys if the API supports them.

## Failure Modes

| Failure | Recommended behavior |
|---|---|
| Limiter storage unavailable | Follow route-specific fail-open or fail-closed policy |
| Malformed identity context | Reject or fall back to a safe source-based key |
| High-cardinality attack | Bound key creation and apply source-level limits |
| Clock skew | Prefer server-side time and monitor clock health |
| Counter eviction | Alert and verify storage policy |
| Legitimate traffic throttled | Review telemetry and adjust approved policy |

Fail-open behavior can preserve availability but weaken abuse protection. Fail-closed behavior strengthens enforcement but may make a service unavailable during limiter outages. The decision must be explicit per route, documented, and tested.

## Monitoring and Alerting

Measure allowed and rejected requests by route, caller category, and response status. Monitor limiter storage latency, error rate, key count, memory use, and the proportion of traffic rejected. Do not use raw user IDs, emails, tokens, or IP addresses as unbounded metric labels.

Alert on unusual increases in rejected login attempts, limiter backend failures, and sustained `429` responses affecting legitimate clients. Keep dashboards aligned with service capacity and release changes.

## Testing

1. Verify that requests below the threshold succeed.
2. Verify that the configured threshold produces `429`.
3. Test burst capacity and refill behavior.
4. Confirm that different users do not share a principal bucket unintentionally.
5. Test multiple gateway instances and storage outages.
6. Check `Retry-After` values and client retry behavior.
7. Confirm that logs and metrics do not expose secrets or create unbounded cardinality.

## Rollout and Tuning

Start in observation or shadow mode when supported. Compare projected rejections with expected client traffic, then enable enforcement gradually. Record the policy owner, threshold rationale, rollback condition, and next review date. Changes should be reviewed alongside service capacity and abuse trends rather than copied blindly between endpoints.

See [REPO-APIGW-001] for routing and [REPO-AUTH-001] for authentication endpoint behavior.
