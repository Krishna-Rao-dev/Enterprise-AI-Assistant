export const MOCK_PROJECTS = [
  {
    id: 'payments-service',
    name: 'payments-service',
    description: 'Core payment processing, idempotency keys, and gateway retry strategies',
    defaultScope: true,
    repoUrl: 'https://github.com/northwind/payments-service',
    docsCount: 14,
  },
  {
    id: 'hr-portal',
    name: 'hr-portal',
    description: 'Employee records, leave policy, payroll integration, and onboarding',
    defaultScope: false,
    repoUrl: 'https://github.com/northwind/hr-portal',
    docsCount: 22,
  },
  {
    id: 'platform-infra',
    name: 'platform-infra',
    description: 'Kubernetes ingress, Terraform modules, telemetry, and observability',
    defaultScope: false,
    repoUrl: 'https://github.com/northwind/platform-infra',
    docsCount: 31,
  },
];

export const INITIAL_THREADS = [
  {
    id: 't-pay-1',
    projectId: 'payments-service',
    title: 'Idempotency key TTL in Redis cache',
    updatedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
    displayTime: '19d',
    hasUnread: false,
    messages: [
      {
        id: 'm-1',
        role: 'user',
        content: 'What is the default TTL for idempotency keys in payments-service?',
        timestamp: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm-2',
        role: 'assistant',
        content: 'According to the payments architecture spec, idempotency keys are retained in Redis for **86,400 seconds (24 hours)**. Duplicate payment intents with identical idempotency keys within this window return the cached payload without charging again.',
        timestamp: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000 + 4000).toISOString(),
        citations: [
          {
            doc_id: 'PAY-ARCH-002',
            title: 'Payment Gateway Idempotency Spec',
            section: '§4.1 Redis Caching Layer',
            version: '3.1',
            status: 'current',
            classification: 'internal',
            excerpt: 'All inbound POST /v2/charges carry an Idempotency-Key header. Keys are preserved in Redis with an EXPIRE of 86400 seconds.',
            url: 'https://docs.northwind.internal/payments/PAY-ARCH-002'
          }
        ]
      }
    ]
  },
  {
    id: 't-pay-2',
    projectId: 'payments-service',
    title: 'Webhook signature verification logic',
    updatedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    displayTime: '6mo',
    hasUnread: false,
    messages: [
      {
        id: 'm-3',
        role: 'user',
        content: 'How do we verify webhook signatures from Stripe?',
        timestamp: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm-4',
        role: 'assistant',
        content: 'Webhooks are validated using HMAC-SHA256 with the secret stored in AWS Secrets Manager under `/payments/stripe/webhook_secret`. Requests failing timing-safe equality comparison reject with HTTP 401.',
        timestamp: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000 + 3500).toISOString(),
      }
    ]
  },
  {
    id: 't-hr-1',
    projectId: 'hr-portal',
    title: 'Carry forward leave days cap for 2026',
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    displayTime: '3d',
    hasUnread: false,
    messages: [
      {
        id: 'm-5',
        role: 'user',
        content: 'Can I carry forward more than 5 leave days into 2027?',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm-6',
        role: 'assistant',
        content: 'Under **HR-POL-001 §2**, regular full-time employees may carry forward a maximum of **5 unused annual leave days** into the next calendar year. Any additional balance lapses unless an explicit statutory override applies.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 4200).toISOString(),
        citations: [
          {
            doc_id: 'HR-POL-001',
            title: 'Leave and Paid Time Off Policy',
            section: '§2 Annual leave entitlement',
            version: '2.0',
            status: 'current',
            classification: 'public',
            excerpt: 'Annual PTO is intended to be used during the year. Up to 5 unused days may carry forward into the next calendar year, subject to local law.',
            url: 'https://docs.northwind.internal/hr/HR-POL-001'
          }
        ]
      }
    ]
  },
  {
    id: 't-infra-1',
    projectId: 'platform-infra',
    title: 'Cluster autoscaler threshold configs',
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    displayTime: '14d',
    hasUnread: false,
    messages: [
      {
        id: 'm-7',
        role: 'user',
        content: 'What is the scale-up CPU target on the production EKS cluster?',
        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'm-8',
        role: 'assistant',
        content: 'The production node group scales when aggregate CPU allocation exceeds **75% utilization for 3 consecutive 1-minute metrics intervals**.',
        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 3800).toISOString(),
      }
    ]
  }
];
