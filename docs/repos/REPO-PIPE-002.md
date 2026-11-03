---
doc_id: REPO-PIPE-002
title: "Data Pipeline — Runbook"
repo: data-pipeline
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Purpose

This runbook guides engineers through common data pipeline incidents: stalled jobs, elevated failures, delayed outputs, and invalid-record spikes. It is a generic operational template and must be reconciled with actual dashboards, commands, and escalation paths before production use. Do not run destructive recovery commands without confirming the target environment and obtaining the required approval.

## Severity and Initial Assessment

| Signal | Possible severity | First response |
|---|---|---|
| One isolated record failure | Low | Inspect reason code and quarantine |
| Repeated job failures | Medium or high | Check recent deployments and dependencies |
| Output freshness objective breached | Based on downstream impact | Identify blocked stage and consumers |
| Queue depth growing continuously | Potentially high | Check consumer health and throughput |
| Suspected data corruption or exposure | High | Stop unsafe processing and escalate |

Use the incident process to assign an owner, record a start time, and maintain a timeline. Avoid sharing sensitive payloads in public incident channels.

## Standard Triage

1. Confirm the affected environment, pipeline name, and run ID.
2. Check service health, scheduler status, queue depth, and latest successful run.
3. Compare failure rate and latency with the normal baseline.
4. Inspect recent code, configuration, schema, and infrastructure changes.
5. Identify the failing stage: ingestion, validation, transformation, storage, or publishing.
6. Determine whether the issue affects all records or a subset.
7. Preserve relevant logs and metrics before retrying or restarting work.

Useful diagnostic commands depend on the deployment platform. Use the approved observability console or documented command-line tools. Do not invent or run commands against production based only on this template.

## Common Incidents

### Jobs are not starting

Check scheduler health, trigger configuration, service account permissions, and dependency availability. Verify that the intended schedule and timezone are correct. Look for a previous run holding a concurrency lock. If a scheduler change was recently deployed, compare the active configuration with the last known good version.

Do not manually launch duplicate jobs until you know whether the system prevents concurrent execution. If a manual run is approved, record its run ID and ensure downstream writes are idempotent.

### Jobs fail during ingestion

Verify source connectivity, credentials, pagination behavior, API quotas, and upstream schema changes. Check whether the source has returned an empty page, malformed response, or a transient server error. If credentials may have expired, rotate them through the approved secret-management process. Never paste credentials into logs or tickets.

Retry only transient failures. For persistent source errors, pause repeated retries if they amplify load or trigger upstream throttling.

### Invalid-record count spikes

Compare the observed schema and validation error codes with the prior successful run. Check for a producer release, changed field types, missing required attributes, or encoding changes. Quarantine invalid records with bounded diagnostic context. Do not bypass validation to make the run appear successful.

If the source contract changed legitimately, coordinate a versioned schema update and test it with representative non-sensitive fixtures.

### Outputs are delayed

Inspect queue depth, worker utilization, storage latency, and publisher errors. Determine whether processing is slow, blocked, or complete but unable to publish. Check downstream availability and retry queues. If capacity needs to be increased, use the approved scaling procedure and monitor for dependency saturation.

## Recovery and Replay

Before replaying data, determine the last durable checkpoint and the idempotency guarantees of every affected stage. Identify the time range or record set to replay, estimate the resulting load, and confirm that consumers can handle duplicates if any stage is at-least-once. Obtain approval where the replay could overwrite curated data or trigger external side effects.

A safe replay procedure should:

1. Capture the failed run ID and checkpoint.
2. Preserve failure metadata and quarantine references.
3. Select the smallest affected partition or range.
4. Validate the replay plan in a non-production environment when practical.
5. Run the approved replay mechanism.
6. Compare record counts and output checksums with expected values.
7. Verify downstream freshness and consumer behavior.
8. Record the recovery outcome in the incident timeline.

Never delete checkpoints or clear a queue as a first-line fix.

## Rollback

If a recent deployment caused the incident, use the standard deployment rollback process. Confirm compatibility between the previous code version and current schemas before reverting. Avoid rolling back database migrations or schema changes unless a reviewed rollback plan exists. After rollback, rerun health checks and validate a small controlled pipeline execution.

## Escalation and Closure

Escalate to the service owner when repeated retries fail, data correctness is uncertain, a freshness objective is breached, or the incident may involve unauthorized access. Include run IDs, timestamps, affected stages, sanitized error codes, deployment references, and observed impact.

Close the incident only after processing has recovered, output correctness has been checked, backlog is stable, and stakeholders have been informed. Follow up with a root-cause analysis for material incidents and assign owners and due dates to corrective actions.

See [REPO-PIPE-001] for the architecture and data-flow model.
