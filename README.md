# AskRera

A MahaRERA data scraping and analysis platform that automates real estate project due diligence by extracting project data from the Maharashtra RERA portal, structuring it in a database, and computing automated red flags for risk assessment.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Scraping**: Cheerio for HTML parsing
- **Validation**: Zod for schema validation

## Project Structure

```
packages/
├── db/          Database schema, migrations, and Prisma client
└── scraper/     Web scraping pipeline and red flag computation
```

### packages/db

Database layer with Prisma schema defining:

- `ProjectListing` - Scraped listing data from search results
- `Project` - Detailed project information
- `Developer` - Promoter/developer records with canonical names and aliases
- `Filing` - Project filings and documents
- `Litigation` - Legal cases associated with projects
- `RedFlag` - Automated risk indicators

### packages/scraper

Scraping pipeline that:

1. Fetches project listings from MahaRERA search endpoint
2. Scrapes detailed project data via internal API
3. Parses and validates data with Zod schemas
4. Upserts to PostgreSQL via Prisma
5. Computes red flags for each project

## Setup

Install dependencies:

```bash
bun install
```

Configure environment variables:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/askrera
RERA_TOKEN=your_rera_api_token
```

Run database migrations:

```bash
cd packages/db
bunx prisma migrate dev
```

## Usage

### Scraper CLI

The scraper supports three modes:

**Test mode** - Scrape first 5 projects:

```bash
bun run packages/scraper/src/cli.ts --mode test
```

**Daily mode** - Scrape projects modified in the last 7 days:

```bash
bun run packages/scraper/src/cli.ts --mode daily
```

**Full mode** - Scrape all projects:

```bash
bun run packages/scraper/src/cli.ts --mode full
```

### Package scripts

```bash
bun run format        # Check code formatting
bun run format:fix    # Auto-format code
```

## Red Flags

The system automatically computes five risk indicators:

1. **completion_date_delayed** - Proposed completion date extended beyond original
2. **project_lapsed** - Project registration has lapsed
3. **extension_granted** - Extension certificate has been issued
4. **zero_units_registered** - No units registered (excludes migrated projects)
5. **no_sales_recorded** - Zero sales after 1+ year of registration

Red flags are derived on each scrape and automatically resolved when conditions no longer apply.

## License

Private project.
