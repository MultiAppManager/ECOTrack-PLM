-- Enforce status as PostgreSQL enums (type-safe at DB level)
-- product: lifecycle Active | Archived
-- eco_request: full ECO workflow (matches application strings)

-- ─── product.status ─────────────────────────────────────────────────────────
CREATE TYPE "ProductStatus" AS ENUM ('Active', 'Archived');

ALTER TABLE "product" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "product" SET "status" = 'Active'
WHERE "status" IS NULL OR "status" NOT IN ('Active', 'Archived');

ALTER TABLE "product"
  ALTER COLUMN "status" TYPE "ProductStatus"
  USING ("status"::"ProductStatus");

ALTER TABLE "product"
  ALTER COLUMN "status" SET DEFAULT 'Active'::"ProductStatus";

-- ─── eco_request.status ───────────────────────────────────────────────────────
CREATE TYPE "EcoRequestStatus" AS ENUM (
  'Draft',
  'Reviewed',
  'Rejected',
  'Approved',
  'Applied',
  'New',
  'In Progress'
);

ALTER TABLE "eco_request" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "eco_request" SET "status" = btrim("status"::text);

UPDATE "eco_request" SET "status" = 'Draft'
WHERE "status" IS NULL
   OR "status" NOT IN (
        'Draft', 'Reviewed', 'Rejected', 'Approved', 'Applied', 'New', 'In Progress'
      );

ALTER TABLE "eco_request"
  ALTER COLUMN "status" TYPE "EcoRequestStatus"
  USING ("status"::"EcoRequestStatus");

ALTER TABLE "eco_request"
  ALTER COLUMN "status" SET DEFAULT 'Draft'::"EcoRequestStatus";
