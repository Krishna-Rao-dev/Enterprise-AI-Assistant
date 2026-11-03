---
doc_id: REPO-INFRA-001
title: "Infrastructure Terraform — Environment Setup"
repo: infra-terraform
allowed_groups:
  - engineering
  - it_admin
status: current
version: "1.0"
last_updated: "2026-10-23"
---

## Overview

The infrastructure Terraform repository defines repeatable infrastructure provisioning for Northwind environments. This guide covers safe workstation setup, configuration, plan review, and deployment hygiene. The actual provider, module layout, state backend, and Terraform version must be confirmed from the repository files before running commands.

## Prerequisites

| Requirement | Purpose | Verification |
|---|---|---|
| Git | Source control | `git --version` |
| Terraform | Infrastructure planning | `terraform version` |
| Cloud CLI | Authenticate to target account | Provider-specific version command |
| Approved identity | Least-privilege access | Verify account and role |
| Remote state access | Shared state and locking | Check backend configuration |

Use the Terraform version declared in `.terraform-version`, CI configuration, or module constraints. A version mismatch can change provider resolution or plan output. Do not install providers from unapproved registries.

## Repository Setup

Clone the approved repository and inspect its directory structure:

```bash
git clone <approved-repository-url>
cd infra-terraform
git status --short
find . -maxdepth 2 -type f
```

Review module READMEs, provider constraints, backend configuration, environment directories, and CI workflows. Confirm that the working branch and target environment are correct. Never run an apply operation simply because initialization succeeds.

## Configuration

Environment configuration may be supplied through `.tfvars` files, environment variables, workload identity, or the approved secrets platform. Typical variables include:

| Setting | Purpose | Handling |
|---|---|---|
| `environment` | Selects deployment environment | Use an approved value |
| `region` | Cloud region | Confirm with platform owner |
| `project_id` or account ID | Target account | Verify before planning |
| `state_backend` | Remote state location | Use the configured backend |
| Provider credentials | API authentication | `[REDACTED]`, never commit |
| `tags` or labels | Ownership and cost allocation | Follow naming standards |

These are conceptual settings, not guaranteed Terraform variable names. Inspect `variables.tf`, provider blocks, and environment examples for the actual interface. Never put secrets in plain-text variable files that may be committed or captured in plan artifacts.

## Initialize and Validate

Run the following from the intended root module:

```bash
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan -var-file="<approved-environment-file>"
```

Use the repository's documented backend and initialization flags. Do not use `-reconfigure`, `-migrate-state`, or state manipulation commands without understanding their effects and following the platform team's procedure.

Inspect the plan carefully. Confirm account, region, resource names, network boundaries, IAM changes, storage exposure, and destructive replacements. A plan file can contain sensitive values, so store it securely and do not attach it to public tickets.

## State Management

Use the approved remote backend with state locking and access controls. Terraform state may contain resource identifiers and sensitive attributes even when outputs are marked sensitive. Limit read access to authorized operators and encrypt state at rest and in transit.

Do not edit state files manually or delete a lock to unblock a command without confirming that no active operation owns it. If state drift or corruption is suspected, stop and contact the infrastructure owner. Preserve relevant logs and state version information before recovery.

## Apply Procedure

1. Confirm the change request and target environment.
2. Review the exact plan with another authorized engineer when required.
3. Verify the cloud account and role using the provider CLI.
4. Apply only the reviewed plan or approved pipeline artifact.
5. Monitor the command to completion and retain the operation ID.
6. Run post-deployment health checks and inspect relevant telemetry.
7. Record the result and any deviations from the expected plan.

For production, prefer the approved CI/CD workflow over an unreviewed local apply. Never apply changes from an unknown branch or use broad administrator credentials when a narrower role is available.

## Troubleshooting

| Symptom | Likely cause | Safe next step |
|---|---|---|
| Provider authentication fails | Expired identity or wrong account | Reauthenticate and verify target |
| State lock present | Another operation is running | Confirm owner before any unlock |
| Plan proposes unexpected replacement | Drift or changed resource identity | Stop and inspect plan and state |
| Provider version conflict | Constraint or lockfile mismatch | Follow dependency update process |
| Permission denied | Role lacks required action | Request least-privilege access |

## Security Requirements

Use short-lived credentials or workload identity wherever supported. Store secrets in approved secret-management systems and represent them as `[REDACTED]` in documentation. Restrict public ingress, use least-privilege IAM, encrypt storage, and enable audit logs for sensitive control-plane operations. Avoid committing `.tfstate`, crash logs, secret-bearing plans, private keys, or local override files.

## Change Review and Rollback

Infrastructure rollback is not always equivalent to reverting a Git commit. Some resources contain persistent data or irreversible changes. Before deployment, identify data migration implications, backup requirements, and recovery steps. If a change fails, stop further applies, inspect actual resource state, and follow the service-specific recovery plan rather than blindly applying an older configuration.

See [REPO-APIGW-001] for gateway infrastructure dependencies and the relevant service runbooks for application-level validation.
