# Enterprise Knowledge Assistant

An enterprise-oriented knowledge assistant with a React interface and a FastAPI
service for permission-filtered retrieval-augmented generation (RAG). The
implemented backend combines PostgreSQL-backed user groups, ChromaDB vector
search, BM25 lexical retrieval, reciprocal-rank fusion, CrossEncoder reranking,
Groq-hosted language-model generation, MongoDB conversation history, and
PostgreSQL query auditing.

> **Implementation status:** This repository currently implements the RAG
> request path described below. The router-agent/MCP Jira and HR action
> workflow and production human-approval interrupt are not wired into the
> backend. The UI's simulated mode can demonstrate action and approval
> interactions, but it does not call Jira or an MCP server. Terraform
> deployment configuration is provided under `infra/terraform/`; AWS
> resources are created only after an operator reviews and applies it.

## Contents

- [Capabilities](#capabilities)
- [Architecture](#architecture)
- [Request lifecycle](#request-lifecycle)
- [Access-control model](#access-control-model)
- [Document ingestion and indexing](#document-ingestion-and-indexing)
- [MCP and human approval: intended integration](#mcp-and-human-approval-intended-integration)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Running with Docker](#running-with-docker)
- [AWS ECS Fargate deployment](#aws-ecs-fargate-deployment)
- [API reference](#api-reference)
- [Repository layout](#repository-layout)
- [Operational and security notes](#operational-and-security-notes)

## Capabilities

- **Permission-aware knowledge search.** Policy and repository documents are
  indexed with document metadata and group labels. Retrieval receives the
  resolved user's groups from the backend's PostgreSQL user record, not
  from the language model.
- **Hybrid retrieval.** Dense similarity search in ChromaDB and sparse
  BM25 retrieval produce candidate passages. Reciprocal Rank Fusion (RRF)
  merges the ranked lists; a CrossEncoder then reranks the fused candidates.
- **Grounded responses.** The generation prompt instructs the model to answer
  from retrieved context, cite document identifiers, prefer current material,
  and treat document contents as untrusted data rather than instructions.
- **Streaming chat API.** The backend emits Server-Sent Events (SSE) for
  retrieval/reranking/generation stages, source metadata, generated text, and
  completion or error.
- **Persistent records.** MongoDB stores chat threads and feedback.
  PostgreSQL stores user records and query audit entries.
- **Interactive frontend.** The React application supports a local simulated
  experience and a backend-connected mode.
- **Container build targets.** The root Dockerfile defines separate `frontend`
  and `backend` image targets suitable for separate ECS services.

## Architecture

### Implemented application path

GitHub renders Mermaid diagrams in Markdown natively. The diagram below shows
the current backend request path; it does not imply that the simulated Jira,
HR, or approval UI is connected to external services.

```mermaid
flowchart LR
    U[User] --> UI[React and Vite frontend]
    UI -->|POST /api/chat/stream, SSE| API[FastAPI service]

    API -->|Resolve active user and groups| PG[(PostgreSQL)]
    API -->|Load conversation history| MDB[(MongoDB)]
    API --> G[LangGraph RAG graph]

    subgraph Retrieval and generation
        G --> V[ChromaDB vector retrieval<br/>group metadata filter]
        G --> B[BM25 lexical retrieval<br/>group pre-filter]
        V --> R[RRF fusion]
        B --> R
        R --> X[CrossEncoder reranker]
        X --> L[Groq Chat model]
    end

    L -->|Stream answer tokens| API
    API -->|Persist messages| MDB
    API -->|Audit question, source IDs,<br/>answer hash and latency| PG
    API -->|SSE stages, sources, tokens, done| UI
```

ChromaDB is a local persistent index directory in the current implementation,
not an independently deployed database service. The graph's
`MemorySaver` is process-local; persistent user-facing chat history is stored
separately in MongoDB.

### AWS deployment target

This is a reference topology for deploying the two Docker targets. The
repository does not include CloudFormation, CDK, Terraform, ECS task
definitions, or network policies to create it.

```mermaid
flowchart TB
    Client[Browser]
    Edge[CloudFront distribution<br/>AWS WAF web ACL]
    ECR[(Amazon ECR)]
    Secrets[(AWS Secrets Manager)]
    Logs[(CloudWatch Logs)]

    subgraph VPC[Application VPC]
        subgraph Public[Public subnets]
            ALB[Application Load Balancer]
            NAT[NAT gateway<br/>controlled outbound access]
        end

        subgraph Private[Private application subnets]
            Web[ECS Fargate service<br/>frontend image, port 8080]
            API[ECS Fargate service<br/>backend image, port 8000]
        end

        subgraph Data[Private data subnets or managed private endpoints]
            PG[(Amazon RDS for PostgreSQL)]
            Mongo[(MongoDB deployment)]
        end
    end

    Client --> Edge --> ALB
    ALB --> Web
    ALB --> API
    Web -->|/api path routing, if configured| API
    API --> PG
    API --> Mongo
    API -. task-role access .-> Secrets
    ECR -. image pull .-> Web
    ECR -. image pull .-> API
    Web -. logs .-> Logs
    API -. logs .-> Logs
    API -. model/API egress as required .-> NAT
```

For private-subnet isolation, place Fargate tasks in private subnets without
public IP addresses. Permit inbound traffic only from the load balancer's
security group, and permit database traffic only from the backend task's
security group. Use VPC endpoints where appropriate; otherwise provide
controlled NAT egress for image/model downloads and external model-provider
requests. Associate AWS WAF with CloudFront or a supported regional
Application Load Balancer, depending on the selected edge topology.

The current frontend Nginx image serves static files only. It does not proxy
`/api` to the backend. A production deployment must either configure a
reverse-proxy/API path route and build-time API base URL or expose the API
behind an appropriately protected endpoint and configure the frontend with
that URL. The Dockerfile does not provision this routing.

## Request lifecycle

In backend-connected mode, a chat request follows these stages:

1. The frontend posts a question, optional thread identifier, user identifier,
   and optional repository scope to `POST /api/chat/stream`.
2. FastAPI looks up the user in PostgreSQL and rejects unknown or inactive
   users. It obtains the user's groups from that record and loads recent
   conversation history from MongoDB.
3. The retrieval layer queries ChromaDB using a metadata filter constructed
   from the user's groups. It separately filters in-memory BM25 candidates
   using the same group authorization requirement.
4. The dense and lexical result lists are fused using reciprocal rank:
   `score(d) = Σ 1 / (60 + zero_based_rank(d))`. A CrossEncoder scores the
   fused passages against the question and returns the highest-ranked context.
5. If authorized context is available, the configured Groq chat model
   generates an answer using the retrieved passages and recent conversation
   history. The prompt asks for `[doc_id]` citations and an explicit
   not-found response when the context is insufficient. If no documents are
   available, the service returns a fixed no-access/no-results response
   without invoking generation.
6. The API emits SSE events for each retrieval stage, source metadata, and
   generated text. After generation, it appends the user and assistant
   messages to MongoDB and inserts an audit record in PostgreSQL.

The non-streaming `POST /api/chat` endpoint runs the compiled RAG graph
synchronously and returns the complete response. The streaming endpoint
currently performs the corresponding retrieval, reranking, and model streaming
directly in the route handler; it does not stream LangGraph node execution.

## Access-control model

The access-control mechanism is metadata-based group filtering:

1. **User-to-group resolution:** the API loads the requested `user_id` from
   PostgreSQL and takes the user's stored `groups`. Unknown and inactive
   users are rejected. The request does not accept a caller-supplied group
   list.
2. **Document labeling:** ingestion places a comma-separated
   `allowed_groups` value and Boolean `grp_<group>` metadata fields on every
   ChromaDB chunk.
3. **Vector pre-filter:** ChromaDB receives a metadata predicate matching at
   least one of the user's `grp_<group>` fields. When a repository is
   specified, the vector query also scopes results to that repository while
   retaining policy documents.
4. **Lexical pre-filter:** before BM25 ranking, the in-memory chunk collection
   is filtered to documents whose `allowed_groups` intersect the user's
   groups. A requested repository excludes chunks tagged to other repositories.
5. **Authorized context only:** only the returned passages are fused,
   reranked, and passed to the language model.

This design reduces the chance of unauthorized passages entering model
context; its guarantee depends on correct document metadata and trustworthy
identity resolution. In this repository, the API accepts `user_id` directly
from the client and does not authenticate that identity. Do not expose this
mode to untrusted users without adding authentication and binding the user ID
to a verified principal.

The `repo_access` PostgreSQL table is defined in the data model, but the
current retrieval path does not query it. Repository scoping is based on the
request's `repo` value plus document metadata; it is not an independent
authorization check against `repo_access`.

## Document ingestion and indexing

`backend/ingest.py` reads Markdown files from:

- `docs/policies/*.md`
- `docs/repos/*.md`

Each file uses YAML front matter. Policy documents require `doc_id`, `title`,
`status`, `version`, `last_updated`, and `allowed_groups`. Repository documents
also require a `repo` slug. Group values must belong to the allowlist in the
ingestion script.

The ingestion pipeline:

1. Parses the Markdown front matter and validates required metadata.
2. Splits content at Markdown heading levels 1 through 3 using
   `MarkdownHeaderTextSplitter`.
3. Extracts Markdown tables from each section and partitions table rows into
   chunks of up to 15 rows while retaining the table header and separator.
4. Splits non-table text with `RecursiveCharacterTextSplitter` using an
   800-character chunk size and 100-character overlap.
5. Adds document, section, source-type, group, version, status, and (where
   applicable) repository metadata to each chunk.
6. Embeds the chunks using `BAAI/bge-small-en-v1.5` and writes the persistent
   ChromaDB index to `backend/chroma_db`.

Running ingestion rebuilds the ChromaDB directory. Back up or regenerate the
index rather than treating it as a migration-safe database.

Example policy front matter:

```yaml
---
doc_id: HR-POL-001
title: Leave Policy
status: current
version: "1.0"
last_updated: "2026-09-01"
allowed_groups:
  - all_employees
  - hr
---
```

Example repository front matter:

```yaml
---
doc_id: REPO-AUTH-001
title: Authentication Service Guide
repo: auth-service
allowed_groups:
  - engineering
  - it_admin
---
```

## MCP and human approval: intended integration

The backend currently has **no MCP client/server implementation**, no
router-agent node, and no backend approval/resume endpoint. Its LangGraph
consists of `retrieve → rerank → generate`. Jira-related screens and
interrupt-like events in the frontend are part of the simulator. The
backend-connected frontend explicitly rejects approval/resume requests
because the API does not expose them.

For the resume-described design, MCP would provide a standardized tool
boundary between the agent host and external systems:

1. A router node would classify the user's intent and route read-only
   knowledge questions to the RAG subgraph or action requests to the
   appropriate tool workflow.
2. The agent host would connect to separately configured MCP servers, discover
   their tools and input schemas, and expose approved tools to the relevant
   graph nodes. A Jira MCP server might offer ticket lookup and ticket
   creation; an HR server might expose narrowly scoped HR operations.
3. The graph would validate tool arguments and construct a proposed action.
   Read operations could execute under the applicable authorization policy.
   Write operations would pause before the tool call and return a durable
   approval request to the client.
4. After an explicit approval decision, a trusted backend endpoint would
   resume the graph and invoke the MCP tool. Rejection, expiry, authorization
   changes, and tool failures would terminate or update the action without
   silently treating it as successful.
5. The result would be returned as part of the unified response and recorded
   with the acting principal and outcome in the audit trail.

That flow requires server-side graph state/checkpoint persistence, authenticated
approval ownership, action-specific authorization, MCP transport and
credential configuration, and audit/event handling. None of those MCP
execution or production approval guarantees should be inferred from the
simulator UI.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite 6, JavaScript, Zustand, Tailwind CSS, Radix UI |
| API | Python 3.11, FastAPI, Uvicorn, Pydantic |
| Orchestration and RAG | LangGraph, LangChain, LangChain Groq |
| Sparse retrieval | `rank_bm25` / LangChain `BM25Retriever` |
| Vector retrieval | ChromaDB, Hugging Face `BAAI/bge-small-en-v1.5` embeddings |
| Reranking | Sentence Transformers CrossEncoder, `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Relational data | PostgreSQL, SQLAlchemy async, asyncpg |
| Conversation and feedback | MongoDB, Motor |
| Containers | Docker multi-stage build, Nginx static frontend |
| Intended cloud deployment | Amazon ECS Fargate, VPC, AWS Secrets Manager, AWS WAF |

## Prerequisites

- Python 3.11
- Node.js 22 or compatible with the Vite project
- PostgreSQL and MongoDB instances reachable from the backend
- A Groq API key and network access to the configured model provider
- Internet access on first backend startup to download the embedding and
  reranker models, unless their Hugging Face cache is pre-populated
- Docker Desktop or another Docker Engine for container builds

The backend initializes the PostgreSQL tables and seeds users from
`backend/users.json` at application startup. MongoDB must be available before
chat, history, or feedback operations are used. The existing ChromaDB index is
included in the repository; regenerate it after changing indexed documents.

## Local setup

### 1. Configure the backend

From the repository root in PowerShell:

```powershell
Copy-Item .env.example backend\.env
cd backend
```

Edit `backend/.env` and set valid local service credentials. The root
[.env.example](./.env.example) contains placeholder local backend values; it
is not a Terraform variables file. AWS configuration is maintained in
`infra/terraform/`.

```dotenv
GROQ_API_KEY=your-groq-api-key
PG_DSN=postgresql+asyncpg://postgres:your-password@localhost:5432/enterprise_rag
MONGO_URI=mongodb://localhost:27017
MONGO_DB=enterprise_rag
CHROMA_DIR=chroma_db
```

Create and install the backend environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, use the Python executable directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. Build or refresh the knowledge index

Run ingestion from the `backend` directory so its relative document paths
resolve correctly:

```powershell
python ingest.py
```

This downloads the embedding model if needed and rebuilds `backend/chroma_db`.
The backend also expects `backend/users.json` at startup.

### 3. Start the API

From `backend`:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check `http://localhost:8000/health` for the health response and
`http://localhost:8000/docs` for the interactive OpenAPI page.

### 4. Start the frontend

In a second terminal, from the repository root:

```powershell
cd Frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

The frontend defaults to simulated mode. To use the backend, edit the
generated `.env` file in `Frontend/`:

```dotenv
VITE_USE_MOCK=false
VITE_API_USER_ID=u_isha
VITE_API_BASE_URL=
VITE_BACKEND_URL=http://localhost:8000
```

`VITE_API_USER_ID` must match an active user seeded into PostgreSQL. Vite
proxies `/api` and `/health` to `VITE_BACKEND_URL` during local development.
These Vite variables are client-side configuration, not secret storage.
Restart the Vite server after changing them.

## Configuration

| Variable | Component | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Backend | Credential for the Groq chat model. Keep it server-side. |
| `LLM_MODEL` | Backend | Groq model identifier; defaults to `llama-3.3-70b-versatile`. |
| `PG_DSN` | Backend | SQLAlchemy async PostgreSQL connection string. |
| `MONGO_URI` | Backend | MongoDB connection URI; defaults to `mongodb://localhost:27017`. |
| `MONGO_DB` | Backend | MongoDB database name; defaults to `enterprise_rag`. |
| `CHROMA_DIR` | Backend | ChromaDB persistence directory; defaults to `chroma_db`. |
| `POLICIES_GLOB` | Backend config | Policy-document glob; defaults to `docs/policies/*.md`. |
| `REPO_DOCS_GLOB` | Backend config | Repository-document glob; defaults to `docs/repos/*.md`. |
| `VITE_USE_MOCK` | Frontend | Set to `false` to call the backend; otherwise the simulator is used. |
| `VITE_API_USER_ID` | Frontend | Backend user identifier sent with API requests. |
| `VITE_API_BASE_URL` | Frontend | Optional API origin prefix; empty uses the same origin. |
| `VITE_BACKEND_URL` | Frontend dev server | Vite development proxy destination; defaults to `http://localhost:8000`. |

The retrieval model identifiers are currently constants in
`backend/app/config.py`: `BAAI/bge-small-en-v1.5` and
`cross-encoder/ms-marco-MiniLM-L-6-v2`.

## Running with Docker

The root `Dockerfile` provides two independent targets. Build from the
repository root:

```powershell
docker build --target frontend -t enterprise-knowledge-assistant-frontend:local .
docker build --target backend -t enterprise-knowledge-assistant-backend:local .
```

The frontend target serves the Vite production build with Nginx on port 8080.
The backend target runs Uvicorn on port 8000 and includes the backend
application, indexed ChromaDB files, documents, and seeded user data.

The containers require runtime connectivity to PostgreSQL and MongoDB.
Provide backend settings as environment variables or through a secrets
integration; do not copy credentials into an image. For example, in a local
environment where database services are already running:

```powershell
docker run --rm -p 8000:8000 `
  -e GROQ_API_KEY=$env:GROQ_API_KEY `
  -e PG_DSN=$env:PG_DSN `
  -e MONGO_URI=$env:MONGO_URI `
  enterprise-knowledge-assistant-backend:local
```

The frontend image is static and makes same-origin `/api` requests. The
Terraform ALB rules route those requests to the backend. Docker builds were
not verified in this environment if the Docker Engine is unavailable.

## AWS ECS Fargate deployment

The repository includes a Terraform deployment scaffold in
[`infra/terraform/`](./infra/terraform/). It defines:

- A VPC with public ALB/NAT subnets and private ECS task subnets in two
  Availability Zones. Fargate tasks receive no public IP addresses.
- An internet-facing ALB that accepts traffic only from CloudFront's
  origin-facing managed prefix list. A generated origin-verification header
  is also required by the ALB listener, and requests that do not match it
  receive a 404 response.
- Separate frontend and backend ECS Fargate services and ECR repositories.
  The frontend serves port 8080; `/api/*` and `/health` route to the backend
  on port 8000.
- A CloudFront distribution with AWS WAF attached. WAF enables the AWS
  Common Rule Set, Known Bad Inputs Rule Set, and configurable per-IP rate
  limiting. The WAF scope is `CLOUDFRONT`, so its provider is configured in
  `us-east-1`.
- ECS execution-role access to the three application secrets it needs:
  Groq API key, PostgreSQL DSN, and MongoDB URI. ECS injects these values at
  container startup; plaintext credentials are not put in task definitions.
- A Secrets Manager secret resource reserved for Jira credentials. Terraform
  creates the empty secret only: it does not store a secret value, grant the
  application access to it, or wire Jira into the current backend. Populate
  it only when a server-side Jira integration is implemented.
- CloudWatch log groups with 30-day retention for each service.

The Terraform stack does **not** create PostgreSQL or MongoDB. Configure
reachable managed/private database endpoints in Secrets Manager and ensure
their network policies permit access from the backend task subnets/security
group. It also uses one NAT Gateway for both private subnets to limit baseline
cost; this is a single-AZ egress dependency and should be replaced with
per-AZ NAT or appropriate VPC endpoints for higher availability. The default
CloudFront-to-ALB origin protocol is HTTP; production deployments requiring
TLS on the origin hop should add a custom origin DNS name and matching
regional ACM certificate before enabling HTTPS-only origin communication.

### Prepare and apply

Prerequisites: Terraform 1.6+, AWS CLI credentials with permissions to create
the listed resources, Docker, and existing Secrets Manager string secrets
for Groq, PostgreSQL, and MongoDB. Do not commit populated `terraform.tfvars`,
Terraform state, or plan files.

From the repository root in PowerShell:

```powershell
cd infra\terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`: set the actual secret ARNs and region. Create each
application secret and set its `SecretString` to a plain string (not a JSON
object), because the task definition maps the full secret value to one
environment variable. The PostgreSQL value must be an
`postgresql+asyncpg://...` connection string. Use a protected remote Terraform
state backend with encryption and access controls for team deployments; the
generated origin-verification value is stored in Terraform state.

Initialize Terraform and create the ECR repositories first:

```powershell
terraform init
terraform fmt -check
terraform validate
terraform apply -target=aws_ecr_repository.frontend -target=aws_ecr_repository.backend -var-file=terraform.tfvars
```

Build and push versioned image tags (example tag `v1`):

```powershell
$frontendRepo = terraform output -raw frontend_ecr_repository_url
$backendRepo = terraform output -raw backend_ecr_repository_url
$accountId = (aws sts get-caller-identity --query Account --output text)
$region = "us-east-1" # Match aws_region in terraform.tfvars.
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin "$accountId.dkr.ecr.$region.amazonaws.com"
cd ..\..
docker build --target frontend -t "${frontendRepo}:v1" .
docker build --target backend -t "${backendRepo}:v1" .
docker push "${frontendRepo}:v1"
docker push "${backendRepo}:v1"
cd infra\terraform
```

Set `frontend_image_tag` and `backend_image_tag` to the pushed tags in
`terraform.tfvars`, then create the infrastructure:

```powershell
terraform plan -var-file=terraform.tfvars -out=deployment.tfplan
terraform apply deployment.tfplan
terraform output cloudfront_domain_name
```

The distribution hostname is the public application URL. If using a custom
hostname, request/validate an ACM certificate in `us-east-1` and set both
`cloudfront_aliases` and `cloudfront_acm_certificate_arn`. Database resources,
DNS records, CI/CD, autoscaling, and a production TLS connection from
CloudFront to the ALB must be configured according to the deployment
environment.

The local ChromaDB directory is packaged into the backend image. Each ECS task
has its own container filesystem, so this is a fixed index snapshot, not
shared durable storage. Rebuild and deploy the backend image when the index
changes, or design a shared/indexed retrieval service for a changing corpus.

## API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Basic liveness response. |
| `POST` | `/api/chat` | Run the compiled RAG graph and return a complete answer. |
| `POST` | `/api/chat/stream` | Stream retrieval stages, sources, and answer text as SSE. |
| `GET` | `/api/chat/history?user_id=...` | List recent thread stubs for a user. |
| `GET` | `/api/chat/{thread_id}/messages` | Load messages in a conversation thread. |
| `POST` | `/api/feedback` | Store thumbs-up/down feedback and optional report text. |

Example backend chat request:

```json
{
  "user_id": "u_isha",
  "question": "What is the deployment process for the API gateway?",
  "thread_id": null,
  "repo": "api-gateway"
}
```

The streaming endpoint sends `step`, `sources`, `token`, `done`, and `error`
SSE events. Its `latency_ms` audit value is currently recorded as `"0"`; the
non-streaming endpoint records measured elapsed time.

## Repository layout

```text
.
├── .env.example
├── Dockerfile
├── README.md
├── docs/
│   ├── policies/             # Policy and HR Markdown source documents
│   └── repos/                # Repository guide Markdown source documents
├── infra/
│   └── terraform/            # ECS Fargate, VPC, CloudFront, WAF, IAM, and ECR
├── backend/
│   ├── app/
│   │   ├── db/               # PostgreSQL and MongoDB persistence
│   │   ├── rag/              # Retrieval, generation, and LangGraph workflow
│   │   └── routers/          # FastAPI chat and feedback endpoints
│   ├── chroma_db/            # Persistent vector index
│   ├── ingest.py             # Markdown parsing, chunking, and indexing
│   ├── requirements.txt
│   └── users.json            # Initial user/group seed data
└── Frontend/
    ├── src/
    │   ├── api/              # Backend client and SSE parsing
    │   ├── mock/             # Local UI simulation
    │   └── components/       # React application interface
    ├── package.json
    └── vite.config.js
```

## Operational and security notes

- The backend's current `user_id` request field is not an authentication
  mechanism. Add verified authentication before exposing the API beyond a
  trusted development environment.
- The FastAPI CORS configuration currently allows all origins. Restrict it to
  trusted application origins before production deployment.
- The seeded `backend/users.json` data is sample application data, not an
  identity provider or production user directory.
- PostgreSQL audit records contain the question, source document identifiers,
  answer hash, and latency. Review data retention, access, and privacy
  requirements before production use.
- MongoDB chat history contains message text. Apply appropriate access
  controls, encryption, retention, and backup policies.
- The compiled LangGraph uses `MemorySaver`, which is in-process memory and
  does not provide durable or cross-task approval/checkpoint state.
- Do not infer production Jira/HR write controls from simulated frontend
  approval cards. The backend currently has no Jira/HR MCP execution endpoint.
- The backend loads the embedding and reranker models during application
  startup. Account for model download time, memory, CPU/GPU requirements, and
  task health-check startup grace periods.
