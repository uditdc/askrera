-- AlterTable
ALTER TABLE "projects" ADD COLUMN "status_name" TEXT,
ADD COLUMN "ack_number" TEXT,
ADD COLUMN "cert_generation_date" TIMESTAMP(3),
ADD COLUMN "gross_fees" DOUBLE PRECISION,
ADD COLUMN "promoter_type_id" INTEGER,
ADD COLUMN "location_id" INTEGER;
