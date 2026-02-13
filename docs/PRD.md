# AskRera — Product Requirements Document

**Version:** 1.2
**Last Updated:** 2026-02-09
**Status:** Draft
**Owner:** \[TBD\]

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Segment 1: Scraping & Data Sanitization](#5-segment-1-scraping--data-sanitization)
6. [Segment 2: RAG Indexing & LLM Layer](#6-segment-2-rag-indexing--llm-layer)
7. [API & Interface Contract](#7-api--interface-contract)
8. [User Stories](#8-user-stories)
9. [Data Model (High-Level)](#9-data-model-high-level)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Success Metrics / KPIs](#11-success-metrics--kpis)
12. [Risks & Mitigations](#12-risks--mitigations)
13. [Roadmap](#13-roadmap)
14. [Open Questions](#14-open-questions)

---

## 1. Introduction

**AskRera** is a conversational AI platform that makes public MahaRERA data accessible, searchable, and understandable through a natural-language interface. It ingests regulatory filings from the MahaRERA portal, structures the data, and exposes it via a Retrieval-Augmented Generation (RAG) pipeline so users can perform property due diligence in seconds instead of hours.

---

## 2. Problem Statement

The MahaRERA portal (`maharera.maharashtra.gov.in`) is the single source of truth for real-estate project compliance in Maharashtra. However, it suffers from:

- **High-friction search UX** — captchas on detail pages, multi-step navigation, inconsistent search results.
- **Unstructured data** — critical information (completion dates, litigation, audit reports) is buried in 50+ page PDFs with no machine-readable structure.
- **No change tracking** — users have no way to know when a developer updates a Quarterly Progress Report (QPR) or amends a filing.

Homebuyers, investors, and legal professionals currently spend hours manually cross-referencing documents to answer basic questions like *"Has this project's possession date been delayed?"*

---

## 3. Goals & Non-Goals

### Goals

| # | Goal | Description |
|---|------|-------------|
| G1 | **Ground-truth transparency** | Every data point served by the system must trace back to an original MahaRERA filing. |
| G2 | **Sub-3s query resolution** | A user should get a cited answer to a property question in under 3 seconds. |
| G3 | **Red-flag surfacing** | Proactively highlight risks — delayed timelines, active litigation, missing approvals. |
| G4 | **Data freshness ≤ 7 days** | The scraping pipeline must keep the database within a 7-day sync window of the portal. |

### Non-Goals (v1)

- AskRera does **not** provide financial advice, price predictions, or investment recommendations.
- AskRera does **not** cover RERA jurisdictions outside Maharashtra in Phase 1.
- AskRera is **not** a replacement for legal counsel.

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: LISTING SCRAPE                      │
│  maharera.maharashtra.gov.in/projects-search-result             │
│  (Server-rendered HTML, NO captcha, paginated)                  │
│  → Extract: RERA ID, Project Name, Developer, District,         │
│             Pincode, Location, Last Modified, Internal ID       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ internal project IDs
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: DETAIL API                           │
│  maharerait.maharashtra.gov.in/api/...                          │
│  (REST JSON API, Keycloak JWT auth, captcha-gated session)      │
│  → Extract: Completion dates, registration dates, status,       │
│             fees, unit counts, certificate refs, etc.           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────┐      ┌─────────────────┐      ┌─────────────┐
│  PostgreSQL      │      │  S3             │      │  Vector DB  │
│  (structured)    │◀────▶│  (raw PDFs)     │      │  (Pinecone) │
└────────┬─────────┘      └─────────────────┘      └──────┬──────┘
         │                                                 │
         ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              LLM + RAG Orchestration (LangChain)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Chat UI /   │
                    │  API Client  │
                    └──────────────┘
```

---

## 5. Segment 1: Scraping & Data Sanitization

### 5.1 Objective

Build an automated two-phase pipeline that produces a clean, structured database from the MahaRERA portal.

### 5.2 Portal Architecture (Discovered)

The MahaRERA system runs across **two subdomains** with fundamentally different access patterns:

| Aspect | Listing Pages | Detail API |
|--------|---------------|------------|
| **Host** | `maharera.maharashtra.gov.in` | `maharerait.maharashtra.gov.in` |
| **Stack** | Drupal 9+ (BigPipe SSR) | Java backend + Keycloak OAuth |
| **Auth** | None (public HTML) | Captcha → JSESSIONID → JWT Bearer token |
| **Format** | Server-rendered HTML | JSON REST API |
| **Captcha** | None | Required to obtain session |
| **Data** | Basic project card info | Full project registration details |

### 5.3 Phase 1 — Listing Scrape (No Captcha)

**Endpoint:**
```
GET https://maharera.maharashtra.gov.in/projects-search-result
    ?project_state=27
    &page={1..4655}
    &op=
```

- **46,541 registered projects** across **4,655 pages** (10 per page).
- Server-rendered HTML — no JS execution required.
- No captcha, no authentication.

**Extraction Selectors:**

| Field | Selector / Pattern | Example Value |
|-------|--------------------|---------------|
| RERA Registration No. | First `<p>` in `.col-xl-4`, strip `# ` prefix | `P50500001314` |
| Project Name | `h4.title4 > strong` | `Diamond One` |
| Developer / Promoter | `p.darkBlue.bold` | `Diamond Estate Builders & Developers` |
| Location (Taluka) | `.listingList li:first-child a` → text content | `Nagpur (Urban)` |
| State | Row containing "State" → next `<p>` | `MAHARASHTRA` |
| Pincode | Row containing "Pincode" → next `<p>` | `440010` |
| District | Row containing "District" → next `<p>` | `Nagpur` |
| Last Modified | Row containing "Last Modified" → next `<p>` | `2017-07-27` |
| Internal Project ID | `a.click-projectmodal` href → extract trailing int | `19` |
| Has Extension Cert | `a[data-qstr-flag="DocProjectExtCert"]` exists vs `N/A` | `true` / `false` |

**Implementation:**
- Use `httpx` (async) or `requests` — **no browser automation needed**.
- Throttle to ~2 req/s with jitter to avoid rate limiting.
- Parse with `BeautifulSoup` or `lxml`.
- Store results in `projects_listing` table as a first pass.

### 5.4 Phase 2 — Detail API (Captcha-Gated)

**Auth Flow (Discovered):**

```
1. GET  maharerait.maharashtra.gov.in/public/project/view/{id}
   → Renders captcha page, sets JSESSIONID cookie

2. POST captcha solution (via 2Captcha / Anti-Captcha)
   → Server validates, session becomes authenticated

3. Frontend JS obtains Keycloak JWT:
   - Issuer:   backend-standalone-keycloak-svc-prod:8089
   - Client:   democlient1
   - Username: @maharera_public_view  (shared public viewer account)
   - TTL:      100 minutes
   - Roles:    AGENT (read-only public view)

4. POST JSON API with Bearer token:
   maharerait.maharashtra.gov.in/api/maha-rera-public-view-project-registration-service
     /public/projectregistartion/getProjectGeneralDetailsByProjectId
   Body: {"projectId": 19}
```

**API Response Fields (Mapped):**

| API Field | DB Column | Example | Notes |
|-----------|-----------|---------|-------|
| `projectId` | `internal_id` | `19` | Internal PK, used to call API |
| `projectRegistartionNo` | `rera_id` | `P50500001314` | Public RERA number (note: API has typo "registartion") |
| `projectName` | `name` | `Diamond One` | |
| `projectTypeName` | `project_type` | `Others` | Enum: Others, Building, NA with/without structure |
| `projectCurrentStatus` | `current_status` | `Certificate Signed` | |
| `projectStatusName` | `status_name` | `New` | |
| `projectProposeComplitionDate` | `proposed_completion` | `2019-12-31` | ISO date (note: API typo "Complition") |
| `originalProjectProposeCompletionDate` | `original_completion` | `2019-12-31` | Compare with above to detect delays |
| `reraRegistrationDate` | `registration_date` | `2017-07-27` | |
| `projectApplicationDate` | `application_date` | `2017-07-24` | |
| `registrationCertificateGenerationDate` | `cert_generation_date` | `2017-07-27` | |
| `registrationCertificateDmsRefNo` | `cert_dms_ref` | `f3af6c13-...` | UUID — likely DMS download key |
| `acknowledgementNumber` | `ack_number` | `REA50500005986` | |
| `isBuilding` | `is_building` | `1` | Boolean flag |
| `isNaWithStructure` | `is_na_with_structure` | `0` | |
| `isNaWithoutStructure` | `is_na_without_structure` | `0` | |
| `totalNumberOfUnits` | `total_units` | `0` | May be 0 for migrated projects |
| `totalNumberOfSoldUnits` | `sold_units` | `0` | |
| `projectFeesPayableAmount` | `fees_payable` | `50885.0` | INR |
| `projectCalculatedGrossFeesApplicable` | `gross_fees` | `50885.0` | |
| `isMigrated` | `is_migrated` | `1` | Pre-RERA project migrated in |
| `isProjectLapsed` | `is_lapsed` | `0` | Red flag if `1` |
| `isEligibleGeneralUpdate` | `eligible_update` | `0` | |
| `extensionCertificateDmsRefNo` | `extension_cert_ref` | `null` | Non-null = extension was granted |
| `userProfileTypeId` | `promoter_type_id` | `5` | FK to promoter type enum |
| `projectLocationId` | `location_id` | `127` | FK to location master |
| `promoterName` | `promoter_name` | `null` | Sometimes null, get from listing |
| `projectLocationName` | `location_name` | `Maharashtra` | State-level; district from listing |

**Red Flag Derivations (Computed at Ingest):**

| Flag | Logic |
|------|-------|
| `completion_date_delayed` | `proposed_completion != original_completion` |
| `project_lapsed` | `isProjectLapsed == 1` |
| `extension_granted` | `extensionCertificateDmsRefNo != null` |
| `zero_units_registered` | `totalNumberOfUnits == 0 AND isMigrated == 0` |
| `no_sales_recorded` | `totalNumberOfSoldUnits == 0 AND project is > 1 year old` |

**Implementation:**
- Use **Playwright** to load the detail page and solve the captcha.
- Integrate **2Captcha** (primary) + **Anti-Captcha** (fallback) for automated solving.
- After captcha, intercept the Keycloak token from the browser context (network interception or `localStorage`).
- Once JWT is obtained, make direct `httpx` POST calls to the JSON API — no need to keep the browser open.
- JWT has a **100-minute TTL** — at ~5 req/s, a single JWT session can process ~2,000 projects (Tier 1 only) or ~500 projects (Tier 1 + Tier 2). See §5.5 for tier definitions.
- Rotate residential proxies per session to avoid IP-based blocks.

### 5.5 Detail API Endpoint Catalog (Confirmed)

A single detail page load triggers **76 API calls** (all POST, all JSON, all using the same Bearer token). The full catalog is documented below, organized by priority tier for the scraper.

**Tier 1 — MVP (Scrape for all projects)**

These endpoints provide the core data needed for search, Q&A, and red-flag detection.

| Endpoint | Payload Size | Data Provided |
|----------|-------------|---------------|
| `getProjectGeneralDetailsByProjectId` | 1.85 kB | Core project metadata: dates, status, units, fees (already documented in §5.4) |
| `getProjectAndAssociatedPromoter` | 1.72 kB | Promoter/developer details, associated entities |
| `getProjectCurrentStatus` | 177 B | Current registration status |
| `getStatusForProjectPreview` | 199 B | Status flags for UI rendering |
| `getProjectLandHeaderDetails` | 484 B | Land parcel header: survey numbers, area |
| `getProjectLandAddressDetails` | 577 B | Full project address: street, village, taluka, district, pin |
| `getProjectLandCCDetailsResponse` | 546 B | Commencement Certificate details |
| `getBuildingWingUnitSummary` | 664 B | Unit count breakdown by wing |
| `getProjectPhase` | 159 B | Phase information (for phased projects) |
| `getComplaintByProjectId` | 85 B | Complaint/litigation count and references |
| `getAppealDetailsPublicView` | 73 B | Appellate tribunal case details |
| `getQPRDocsForAdmin` | 103 B | QPR document references (links to downloadable PDFs) |

**Tier 2 — Enhanced (Scrape for priority projects)**

Richer data for deeper analysis. Scrape for top 500 projects initially, expand later.

| Endpoint | Payload Size | Data Provided |
|----------|-------------|---------------|
| `getProjectFormClauseMaster` | 14.44 kB | Full form clause data — largest payload, likely contains regulatory compliance details |
| `getBuildingWingsActivityDetails` | 11.15 kB | Construction activity timeline per wing — key for progress tracking |
| `getMigratedDocuments` | 5.03 kB | Pre-RERA document references |
| `getProjectProfessionalByType` | 3.85 kB | Architects, engineers, CAs associated with project |
| `getBuildingWingsCostEstimation` | 1.17 kB | Cost estimates per wing |
| `getDocumentType` | 2.75 kB | Document type master list |
| `getUploadedDocuments` | 1.31 kB | All uploaded document references (PDFs, certificates) |
| `getProjectMCGMDocuments` | 80 B | Municipal corporation documents (Mumbai-specific) |
| `getBuildingFloorSummaryByFloor` | 80 B | Floor-wise unit breakdown |

**Tier 3 — Low Priority / Conditional**

Endpoints that return empty (80 B) for most projects or provide auxiliary data.

| Endpoint | Notes |
|----------|-------|
| `authenticatePublic` | Auth handshake — already handled in captcha flow |
| `getLoggedInUserDetails` | Returns public viewer profile — not needed |
| `getPromoterSpocDetails` | Promoter SPOC contact (often empty) |
| `getProjectSpocMapping` | SPOC mapping (often empty) |
| `getProjectSroDetails` | Self-Regulatory Org details (often empty) |
| `getProjectNAPlotDetails` | NA plot details (only for non-building projects) |
| `gen_204?csp_test=true` | CSP health check — ignore |

**Scraper Design Implication:**

The scraper should be **endpoint-selective**, not a blanket "call everything" approach:

1. Per project, always call all **Tier 1** endpoints (~12 calls, ~6 kB total).
2. For priority projects (Mumbai/Pune, recently modified, flagged), also call **Tier 2** endpoints (~9 calls, ~40 kB total).
3. Skip **Tier 3** unless specifically needed.
4. At ~5 req/s, a full Tier 1 scrape of one project takes ~2.5 seconds. Within a single 100-min JWT window, we can process **~2,000 projects** (Tier 1 only) or **~500 projects** (Tier 1 + Tier 2).
5. Store raw JSON responses in a `raw_api_responses` JSONB column keyed by `(project_id, endpoint_name, fetched_at)` for future re-processing without re-scraping.

### 5.6 PDF Extraction (OCR)

After discovering document download endpoints, extract structured data from:

| Document Type | Target Fields |
|---------------|---------------|
| **Form 5 (Audit Report)** | Sanctioned FSI, bank account details, fund utilization |
| **Commencement Certificate** | Approval authority, approval date, conditions |
| **Layout Plan** | Number of buildings, total units, amenities |
| **QPR (Quarterly Progress Report)** | Construction %, revised timelines, fund status |

**Tech:** Azure AI Document Intelligence or AWS Textract for table extraction. Confidence thresholds: flag any extraction with < 0.85 confidence for manual review.

### 5.7 Data Cleaning & Normalization

| Task | Approach |
|------|----------|
| Date standardization | All dates to ISO 8601 (`YYYY-MM-DD`). API already returns this format. |
| Developer name normalization | Fuzzy match (Levenshtein + token sort) → canonical lookup table. E.g. `"Godrej Properties Ltd"` ↔ `"GODREJ PROPERTIES"` ↔ `"Godrej Properties"`. |
| Location normalization | Map `projectLocationId` to a master location table (state → division → district → taluka). |
| Deduplication | Match on `rera_id` (unique). Use `internal_id` as the join key between listing and detail data. |

### 5.8 Change Detection & Sync Engine

| Trigger | Detection Method |
|---------|-----------------|
| New project registered | Listing page count increases; new RERA IDs appear on recent pages. |
| QPR uploaded | `last_modified` date changes on listing page for an existing project. |
| Status change | Detail API `projectCurrentStatus` differs from stored value. |
| Extension granted | `extensionCertificateDmsRefNo` goes from `null` to a UUID. |

**Sync strategy:**
1. **Full crawl** (weekly): Re-scrape all 4,655 listing pages. Compare `last_modified` dates. Queue changed projects for detail re-fetch.
2. **Incremental crawl** (daily): Scrape the first ~50 listing pages (sorted by most recent). Pick up newly registered/modified projects.
3. On change detection, re-fetch detail API → update DB → trigger vector re-indexing for affected chunks.

### 5.9 Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | Python 3.11+ | Ecosystem for scraping, OCR, data wrangling |
| Listing Scrape | `httpx` (async) + `BeautifulSoup` | No JS needed; fast, lightweight |
| Detail Scrape | Playwright (captcha pages) + `httpx` (API calls post-auth) | Captcha requires browser; API calls don't |
| Captcha Solving | 2Captcha (primary) + Anti-Captcha (fallback) | Multi-provider resilience |
| Proxy | Residential proxy pool (provider TBD) | Avoid IP bans |
| OCR | Azure AI Document Intelligence | High-fidelity table extraction |
| Structured Storage | PostgreSQL 15+ | Relational model for projects, developers, filings |
| Raw File Storage | S3 (or S3-compatible) | Original PDFs for citation/audit trail |
| Orchestration | Celery + Redis (or Temporal) | Job scheduling, retry, rate limiting |

### 5.10 Acceptance Criteria

- Phase 1 listing scrape completes all 4,655 pages within 2 hours without manual intervention.
- Phase 2 detail fetch achieves ≥ 95% success rate across 500 projects (captcha solve + API call).
- JWT reuse: a single captcha solve must yield ≥ 2,000 Tier 1 project fetches (or ≥ 500 Tier 1+2) before token expiry.
- OCR pipeline extracts "Proposed Completion Date" from Form 5 PDFs with ≥ 95% accuracy (measured against 100-project manually-verified test set).
- Change detection picks up a newly uploaded QPR within 7 days of publication.

---

## 6. Segment 2: RAG Indexing & LLM Layer

### 6.1 Objective

Enable contextual, cited, hallucination-resistant conversations over the structured RERA dataset.

### 6.2 Functional Requirements

| ID | Requirement | Details |
|----|-------------|---------|
| S2-FR1 | **Semantic Chunking** | Break RERA filings into logical sections: Litigation History, Construction Milestones, Financial Audit, Approvals & Certificates. Chunk boundaries must respect section headers and table integrity. |
| S2-FR2 | **Vector Embedding** | Embed chunks using a suitable model (e.g. `text-embedding-3-large`). Store in a managed vector DB. |
| S2-FR3 | **Hybrid Search** | Combine keyword search (for exact RERA IDs, project registration numbers, developer names) with vector similarity search (for semantic queries like *"Is this project safe?"*). |
| S2-FR4 | **Mandatory Citations** | Every LLM-generated answer must include a verifiable link to the source PDF on the MahaRERA portal. If no source can be cited, the system must explicitly say so rather than fabricate an answer. |
| S2-FR5 | **Guardrails** | System prompt + output filter to prevent: financial advice, price predictions, speculative opinions on market trends. |
| S2-FR6 | **Evaluation Pipeline** | Automated eval using the RAGAS framework to measure Faithfulness, Answer Relevancy, and Context Precision on a curated test set. |

### 6.3 Structured Data as Context

Not all queries require vector search. Many questions can be answered directly from the PostgreSQL structured data:

| Query Type | Resolution Path |
|------------|-----------------|
| *"What is the RERA number for Diamond One?"* | Direct SQL lookup on `projects.name` |
| *"Has the completion date been delayed?"* | Compare `proposed_completion` vs `original_completion` |
| *"Is this project lapsed?"* | Check `is_lapsed` flag |
| *"How many units are in this project?"* | Return `total_units` |
| *"Show me all projects by this developer in Pune"* | SQL filter on `developer_name` + `district` |

The RAG layer should implement a **router** that classifies queries as "structured" (→ SQL) or "unstructured" (→ vector search over PDF content) before hitting the LLM.

### 6.4 Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Vector DB | Pinecone or Weaviate | Managed, scalable, supports hybrid search natively |
| LLM | Gemini 1.5 Pro | 2M token context window for large legal filings |
| Orchestration | LangChain or LlamaIndex | Mature RAG tooling, retriever abstractions |
| Evaluation | RAGAS | Standard framework for RAG quality metrics |

### 6.5 Acceptance Criteria

- 100% of LLM responses in production include at least one verifiable source link.
- RAGAS Faithfulness score ≥ 0.90 on the eval test set.
- Chat response latency p95 < 3 seconds.
- Query router correctly classifies structured vs. unstructured queries ≥ 90% of the time.

---

## 7. API & Interface Contract

### 7.1 Core Query Endpoint

```
POST /api/v1/ask
```

**Request:**
```json
{
  "query": "Has the possession date for Lodha Palava been delayed?",
  "filters": {
    "city": "Mumbai",
    "rera_id": "P51800000001"
  }
}
```

**Response:**
```json
{
  "answer": "Yes. The original proposed completion date was December 2023, which was revised to June 2025 in the Q3 2024 QPR filing.",
  "sources": [
    {
      "title": "Form 5 — Q3 2024 QPR",
      "url": "https://maharera.maharashtra.gov.in/...",
      "excerpt": "Revised date of completion: 30-Jun-2025"
    }
  ],
  "confidence": 0.96,
  "red_flags": ["completion_date_delayed"]
}
```

### 7.2 Project Lookup Endpoint

```
GET /api/v1/projects/{rera_id}
```

Returns structured metadata: developer info, registration dates, completion dates (original vs. current), litigation count, last QPR date, red flags, unit counts.

### 7.3 Developer Profile Endpoint

```
GET /api/v1/developers/{developer_id}
```

Returns: canonical name, total projects, delayed projects count, active litigations, compliance score.

---

## 8. User Stories

| ID | Persona | Story | Resolution Path |
|----|---------|-------|-----------------|
| US-1 | Homebuyer | *"Has the possession date for \[Project\] been delayed?"* | Structured: compare `proposed_completion` vs `original_completion` |
| US-2 | Investor | *"What are the active court cases against \[Developer\]?"* | Unstructured: vector search over litigation filings |
| US-3 | First-time buyer | *"Is the building plan actually approved by the BMC?"* | Unstructured: search approval certificates |
| US-4 | Legal professional | *"Show me all projects by \[Developer\] with delayed completion."* | Structured: SQL filter + computed red flags |
| US-5 | Any user | *"Give me a red-flag report for \[Project\]."* | Hybrid: structured flags + unstructured PDF analysis → PDF output (Phase 2) |

---

## 9. Data Model (High-Level)

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   developers     │──1:N──│    projects       │──1:N──│    filings       │
│                  │       │                   │       │                  │
│ id (PK)          │       │ id (PK)           │       │ id (PK)          │
│ canonical_name   │       │ internal_id (UQ)  │       │ project_id (FK)  │
│ aliases[]        │       │ rera_id (UQ)      │       │ filing_type      │
│ total_projects   │       │ developer_id (FK) │       │ filing_date      │
│ created_at       │       │ name              │       │ s3_key           │
└──────────────────┘       │ project_type      │       │ dms_ref          │
                           │ current_status    │       │ extracted_data   │
                           │ district          │       │   (JSONB)        │
                           │ taluka            │       └──────────────────┘
                           │ pincode           │
                           │ original_         │       ┌──────────────────┐
                           │   completion      │──1:N──│   litigations    │
                           │ proposed_         │       │                  │
                           │   completion      │       │ id (PK)          │
                           │ registration_date │       │ project_id (FK)  │
                           │ application_date  │       │ case_number      │
                           │ total_units       │       │ filing_date      │
                           │ sold_units        │       │ status           │
                           │ fees_payable      │       │ summary          │
                           │ is_migrated       │       └──────────────────┘
                           │ is_lapsed         │
                           │ is_building       │       ┌──────────────────┐
                           │ cert_dms_ref      │──1:N──│   red_flags      │
                           │ extension_cert_   │       │                  │
                           │   ref             │       │ id (PK)          │
                           │ last_modified     │       │ project_id (FK)  │
                           │ last_synced       │       │ flag_type        │
                           │ raw_api_response  │       │ detected_at      │
                           │   (JSONB)         │       │ resolved_at      │
                           └───────────────────┘       └──────────────────┘
```

---

## 10. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Latency** | Chat response p95 < 3s. Project lookup API p95 < 500ms. |
| **Availability** | 99.5% uptime for the query layer. Scraping pipeline failures must not affect user-facing services. |
| **Scalability** | System must support 46,541 projects at launch (full Maharashtra), scaling to 100K+ for multi-jurisdiction. |
| **Security** | No PII is stored. All MahaRERA data is public. API endpoints require authentication (API key or OAuth). |
| **Observability** | Structured logging, scraping success/failure rates, captcha solve rates, JWT reuse efficiency, LLM latency and token usage dashboards. |
| **Data Integrity** | Every extracted data point must be traceable to a source (API response or PDF in S3). Raw API responses stored as JSONB. |

---

## 11. Success Metrics / KPIs

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Data Freshness | ≤ 7 days behind portal | `MAX(NOW() - last_synced)` across all active projects |
| Listing Scrape Throughput | 46,541 projects in < 2 hours | Pipeline timer on full crawl |
| Captcha Solve Rate | ≥ 95% | `solved / attempted` per session |
| JWT Reuse Efficiency | ≥ 2,000 Tier 1 API calls per captcha solve | `api_calls / captcha_solves` per session |
| OCR Accuracy (Dates) | ≥ 95% | Manual audit of 100-project test set, quarterly |
| Citation Coverage | 100% of responses | Automated check — every response has ≥ 1 source link |
| Chat Latency (p95) | < 3 seconds | APM on query endpoint |
| RAGAS Faithfulness | ≥ 0.90 | Weekly eval against curated test set |

---

## 12. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MahaRERA listing page HTML structure changes | Listing scraper breaks | High | Abstract selectors into config; regression tests; alerting on parse failures. |
| Detail API endpoints or auth flow changes | Detail ingestion halts | Medium | Version-pin API contracts; monitor for 401/403 spikes; alert on JWT failures. |
| Captcha provider rate-limited or blocked | Cannot obtain new JWTs | Medium | Multi-provider fallback (2Captcha + Anti-Captcha). Pre-warm JWT pool. |
| Keycloak JWT TTL reduced | Fewer API calls per session | Low | Monitor TTL from decoded tokens; adjust batch sizes dynamically. |
| OCR misreads critical dates/numbers | Incorrect data served to users | Medium | Confidence thresholds; flag low-confidence for manual review. |
| LLM hallucinates facts not in source docs | User trust eroded | Medium | Strict RAG grounding; mandatory citations; RAGAS eval gating. |
| Legal/ToS risk from scraping gov portal | Service disruption | Low | Data is public. Scrape respectfully (rate limiting). Consult legal counsel. |
| MahaRERA blocks scraping IPs | Ingestion halted | Medium | Residential proxy rotation; respect rate limits; distribute across time. |

---

## 13. Roadmap

| Phase | Scope | Target |
|-------|-------|--------|
| **Phase 1 — MVP** | Full listing scrape (46K projects). Detail API integration for top 500 projects (Mumbai/Pune). Basic RAG Q&A. Chat UI. | TBD |
| **Phase 2 — Red Flag Reports** | Complete detail ingestion for all 46K projects. PDF report generation. Scheduled change-detection alerts. Developer comparison views. | TBD |
| **Phase 3 — Multi-Jurisdiction** | Extend to UP-RERA, Karnataka-RERA. Abstract scraper into pluggable adapter per jurisdiction. | TBD |

---

## 14. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | What is the legal position on scraping the MahaRERA portal at scale? | Legal | Open |
| 2 | What are the response schemas for Tier 1 endpoints beyond `getProjectGeneralDetailsByProjectId`? Need sample responses for all 12. | Engineering | **Next step** |
| 3 | Can the Keycloak token be obtained without Playwright (e.g., direct OAuth client_credentials flow against `democlient1`)? | Engineering | Open |
| 4 | Gemini 1.5 Pro vs. Claude vs. GPT-4o — LLM selection for cost/latency/context tradeoff? | Engineering | Open |
| 5 | Free tier vs. B2B-only from day one? | Product | Open |
| 6 | Vernacular support (Marathi/Hindi) in Phase 1? | Product | Open |
| 7 | Schema for `filings.extracted_data` JSONB — semi-structured or fully normalized? | Engineering | Open |
| 8 | Is there a bulk export or sitemap on MahaRERA that could shortcut the listing scrape? | Engineering | Open |

---

*End of document.*