-- CreateTable
CREATE TABLE "projects_listing" (
    "id" SERIAL NOT NULL,
    "rera_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "developer" TEXT,
    "location_taluka" TEXT,
    "district" TEXT,
    "pincode" TEXT,
    "last_modified" DATE,
    "internal_id" INTEGER,
    "has_extension_cert" BOOLEAN NOT NULL DEFAULT false,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developers" (
    "id" SERIAL NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "aliases" TEXT[],
    "total_projects" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "internal_id" INTEGER NOT NULL,
    "rera_id" TEXT NOT NULL,
    "developer_id" INTEGER,
    "name" TEXT NOT NULL,
    "project_type" TEXT,
    "current_status" TEXT,
    "district" TEXT,
    "taluka" TEXT,
    "pincode" TEXT,
    "original_completion" TIMESTAMP(3),
    "proposed_completion" TIMESTAMP(3),
    "registration_date" TIMESTAMP(3),
    "application_date" TIMESTAMP(3),
    "total_units" INTEGER,
    "sold_units" INTEGER,
    "fees_payable" DOUBLE PRECISION,
    "is_migrated" BOOLEAN NOT NULL DEFAULT false,
    "is_lapsed" BOOLEAN NOT NULL DEFAULT false,
    "is_building" BOOLEAN NOT NULL DEFAULT false,
    "cert_dms_ref" TEXT,
    "extension_cert_ref" TEXT,
    "last_modified_listing" TIMESTAMP(3),
    "last_synced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_api_response" JSONB,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filings" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "filing_type" TEXT NOT NULL,
    "filing_date" TIMESTAMP(3),
    "local_path" TEXT,
    "dms_ref" TEXT,
    "extracted_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "litigations" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "case_number" TEXT,
    "filing_date" TIMESTAMP(3),
    "status" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "litigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "red_flags" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "flag_type" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "red_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_listing_rera_id_key" ON "projects_listing"("rera_id");

-- CreateIndex
CREATE UNIQUE INDEX "developers_canonical_name_key" ON "developers"("canonical_name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_internal_id_key" ON "projects"("internal_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_rera_id_key" ON "projects"("rera_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filings" ADD CONSTRAINT "filings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litigations" ADD CONSTRAINT "litigations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
