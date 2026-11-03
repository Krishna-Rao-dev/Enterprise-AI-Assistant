---
doc_id: REPO-NOTIF-001
title: "Notification Service — API Reference"
repo: notification-svc
allowed_groups:
  - engineering
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Overview

The Notification Service accepts notification requests, validates recipients and templates, and dispatches messages through configured delivery providers. Supported channels may include email, SMS, or in-app notifications depending on deployment. This reference proposes a stable API shape; confirm channel support, field names, and delivery semantics against the actual service implementation.

## API Summary

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/v1/notifications` | Bearer token | Submit a notification |
| GET | `/api/v1/notifications/{notification_id}` | Bearer token | Retrieve delivery status |
| POST | `/api/v1/notifications/{notification_id}/cancel` | Bearer token | Request cancellation |
| GET | `/health` | Public or internal | Health probe |

## Submit a Notification

### POST /api/v1/notifications

Creates a notification request. The service should validate the caller's permission to notify the target audience, validate the selected channel and template, then enqueue work for asynchronous delivery.

Example request:

```json
{
  "channel": "email",
  "recipient": "alex@northwind.example",
  "template_id": "account-update",
  "template_version": "1",
  "variables": {
    "display_name": "Alex"
  },
  "idempotency_key": "client-generated-unique-key"
}
```

The sample recipient and template are illustrative. Production requests should use approved templates and minimize personal information in variables. Clients should provide an idempotency key when supported to prevent duplicate messages after network retries.

Illustrative success response (`202 Accepted`):

```json
{
  "notification_id": "ntf_example_001",
  "status": "queued",
  "created_at": "2026-10-23T10:00:00Z"
}
```

A `202` response means the service accepted the request, not that the provider delivered the message. Delivery is asynchronous and can later succeed, fail, or be suppressed.

## Retrieve Status

### GET /api/v1/notifications/{notification_id}

Returns the status of a notification the caller is authorized to view.

```json
{
  "notification_id": "ntf_example_001",
  "status": "sent",
  "channel": "email",
  "attempt_count": 1,
  "updated_at": "2026-10-23T10:00:08Z"
}
```

Possible states may include `queued`, `processing`, `sent`, `delivered`, `failed`, `cancelled`, or `suppressed`. The implementation must define whether `sent` means accepted by a provider or confirmed delivered. Avoid returning provider credentials, full message bodies, or unnecessary recipient data in status responses.

Return `404` when the resource does not exist or the caller is not permitted to discover it, according to the service's information-disclosure policy.

## Cancel a Notification

### POST /api/v1/notifications/{notification_id}/cancel

Requests cancellation of a notification that has not passed an irreversible delivery stage. The operation should be idempotent where practical. A cancellation request may be rejected if dispatch has already occurred.

Illustrative response:

```json
{
  "notification_id": "ntf_example_001",
  "status": "cancel_requested"
}
```

The API must distinguish a cancellation request from a confirmed cancellation. Document the point after which provider delivery cannot be recalled.

## Error Contract

| Status | Meaning | Client behavior |
|---|---|---|
| 400 | Invalid channel, template, or payload | Correct the request |
| 401 | Missing or invalid token | Authenticate |
| 403 | Caller cannot notify recipient or inspect resource | Do not retry without permission change |
| 404 | Notification unavailable | Verify ID and access |
| 409 | Idempotency conflict or invalid state transition | Reconcile existing request |
| 429 | Submission rate exceeded | Retry after guidance |
| 503 | Queue or provider dependency unavailable | Retry with bounded backoff |

Errors should use a consistent structure with a machine-readable code and request ID. Do not expose provider stack traces or secrets.

## Delivery and Retry Semantics

The service should persist accepted requests before acknowledging them. Workers should claim jobs safely and record attempt counts. Retry transient provider errors using bounded exponential backoff with jitter. Permanent failures, invalid destinations, and template errors should not be retried indefinitely. After the configured attempt limit, mark the notification failed and expose a safe reason category.

Use deduplication keys or provider idempotency features to limit duplicate delivery. Delivery providers may have different guarantees, so document the actual semantics per channel.

## Security and Privacy

Authenticate API callers and authorize both submission and status lookup. Apply per-caller and per-recipient limits to reduce abuse. Validate template identifiers against an allowlist and escape variables according to the output context. Avoid arbitrary HTML or script injection in rendered email content.

Credentials and provider API keys must be stored in a secret manager and shown as `[REDACTED]`. Logs should exclude message bodies, raw tokens, and unnecessary recipient data. Apply retention and deletion rules to delivery records, and restrict access to operational dashboards.

## Operational Checks

- Confirm queue depth and oldest-message age.
- Monitor provider errors, delivery latency, retries, and permanent failures.
- Test duplicate submissions with the same idempotency key.
- Verify that unauthorized callers cannot inspect another team's notifications.
- Confirm that cancellation behavior is documented and tested.
- Check that provider credentials are rotated without logging secret values.

See [REPO-APIGW-001] for gateway routing and [REPO-APIGW-002] for request-rate controls.
