export const MOCK_DOCS = [
  {
    doc_id: 'HR-POL-001',
    title: 'Leave and Paid Time Off Policy',
    department: 'hr',
    doc_type: 'policy',
    allowed_groups: ['all_employees'],
    classification: 'public',
    version: '2.0',
    status: 'current',
    section: '§2 Annual leave entitlement',
    last_updated: '2026-04-01',
    excerpt: 'Employees receive 24 working days of annual paid leave per completed calendar year (credited monthly at 2 days per month). Annual PTO is intended to be used during the year; up to 5 unused days may carry forward into the next calendar year.',
    url: 'https://docs.northwind.internal/hr/HR-POL-001',
    content: `Employees receive 24 working days of annual paid leave per completed calendar year. The entitlement is credited monthly at 2 days per month.

| Leave category | Annual guideline | Notes |
|---|---:|---|
| Annual PTO / earned leave | 24 working days | Planned rest and personal commitments |
| Sick leave | 8 working days | Medical recovery; doctor certificate for >3 days |
| Bereavement leave | Up to 5 working days | Immediate family member |
| Parental leave | Per local law | Contact HR for country-specific details |

Submit planned PTO in the HR portal at least 5 working days in advance. If the portal displays ERR-4021, open an IT Service Desk ticket using category HRIS > Leave Balance; do not create duplicate requests.`
  },
  {
    doc_id: 'HR-POL-000',
    title: 'Leave and Paid Time Off Policy (Archive)',
    department: 'hr',
    doc_type: 'policy',
    allowed_groups: ['all_employees'],
    classification: 'public',
    version: '1.0',
    status: 'superseded',
    section: '§2 Historical Leave Allowance',
    last_updated: '2024-01-10',
    excerpt: 'Employees received 18 working days of annual leave per completed calendar year. Up to 3 unused days carried forward. (SUPERSEDED by HR-POL-001 effective April 1, 2026).',
    url: 'https://docs.northwind.internal/hr/HR-POL-000',
    content: `Historical policy grant was 18 working days per annum. This policy was formally retired and replaced by HR-POL-001 v2.0 on April 1, 2026, which expanded annual PTO from 18 to 24 working days.`
  },
  {
    doc_id: 'HR-COMP-001',
    title: 'Compensation Bands and Annual Review Guidance',
    department: 'hr',
    doc_type: 'report',
    allowed_groups: ['hr_managers', 'executives'],
    classification: 'restricted',
    version: '2.1',
    status: 'current',
    section: '§2 Indicative annual base salary bands',
    last_updated: '2026-09-15',
    excerpt: 'Restricted reference for compensation planning across India and the United States. Access is strictly limited to members of hr_managers and executives. Indicative base bands: Software Engineer I ₹12–20 LPA / $95k–$135k, Senior Software Engineer ₹30–48 LPA / $160k–$215k.',
    url: 'https://docs.northwind.internal/hr/HR-COMP-001',
    content: `This restricted reference supports compensation planning. Access is limited to hr_managers and executives.

| Job family / level | India range (LPA) | US range (USD) |
|---|---:|---:|
| Software Engineer I | ₹12–20 LPA | $95,000–$135,000 |
| Software Engineer II | ₹20–32 LPA | $130,000–$175,000 |
| Senior Software Engineer | ₹30–48 LPA | $160,000–$215,000 |
| Engineering Manager | ₹42–65 LPA | $185,000–$245,000 |
| Product / Design Specialist | ₹16–35 LPA | $110,000–$190,000 |
| Finance / Operations Analyst | ₹8–18 LPA | $70,000–$115,000 |`
  },
  {
    doc_id: 'HR-HBK-002',
    title: 'Contractor Onboarding and Engagement Guide',
    department: 'hr',
    doc_type: 'handbook',
    allowed_groups: ['contractors', 'all_employees'],
    classification: 'internal',
    version: '1.2',
    status: 'current',
    section: '§4 Billing and Time Off',
    last_updated: '2026-02-15',
    excerpt: 'Contractors are engaged via statement of work (SOW) or supplier agreement. Contractors do not accrue company PTO; billable time is governed strictly by agreed daily/hourly deliverables.',
    url: 'https://docs.northwind.internal/hr/HR-HBK-002',
    content: `Contractors operate under statement of work (SOW) deliverables. Northwind full-time paid leave benefits do not apply to independent contractors. Time off must be communicated to the engagement sponsor 5 business days in advance.`
  },
  {
    doc_id: 'PAY-ARCH-001',
    title: 'Payment Gateway Retry and Exponential Backoff Architecture',
    department: 'engineering',
    doc_type: 'architecture',
    allowed_groups: ['all_employees', 'engineering'],
    classification: 'internal',
    version: '3.2',
    status: 'current',
    section: '§3.2 Gateway Retry Strategy',
    last_updated: '2026-08-20',
    excerpt: 'Transient payment failures (HTTP 502, 503, 504 and network timeouts) retry up to 3 attempts with exponential jitter backoff: 200ms, 800ms, 3200ms. Non-retryable errors (400, 402, 409) fail immediately without retry.',
    url: 'https://docs.northwind.internal/payments/PAY-ARCH-001',
    content: `All outbound gateway calls through the payment broker implement resilience retries:
- Max retry count: 3 attempts
- Backoff algorithm: Full jitter exponential backoff with base 200ms
- Non-retryable HTTP statuses: 400 Bad Request, 402 Payment Required, 409 Conflict
- Redis distributed lock key: lock:charge:{charge_id} with 15s expiration.`
  },
  {
    doc_id: 'INFRA-SRE-012',
    title: 'Service Incident Classification and Response Matrix',
    department: 'engineering',
    doc_type: 'runbook',
    allowed_groups: ['all_employees', 'engineering'],
    classification: 'internal',
    version: '4.0',
    status: 'current',
    section: '§2 Incident Tiers and SLAs',
    last_updated: '2026-07-11',
    excerpt: 'P2 target: Response SLA within 15 minutes, initial customer advisory within 30 minutes, resolution or mitigation target < 4 hours. P2 target requires on-call engineer page and incident bridge creation.',
    url: 'https://docs.northwind.internal/infra/INFRA-SRE-012',
    content: `Incident classification and target resolution times:

| Severity | Description | Response SLA | Target Mitigation |
|---|---|---:|---:|
| P1 | Critical business outage, payments down | 5 mins | < 1 hour |
| P2 | Major degradation, single payment gateway impaired | 15 mins | < 4 hours |
| P3 | Moderate bug, workaround viable | 2 hours | 2 business days |
| P4 | Minor defect or cosmetic issue | 1 business day | Next sprint |`
  }
];
