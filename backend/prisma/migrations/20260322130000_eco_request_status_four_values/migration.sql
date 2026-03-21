-- eco_request.status: only Draft | Reviewed | Rejected | Approved

ALTER TABLE "eco_request" ALTER COLUMN "status" DROP DEFAULT;

-- Normalize legacy strings (works for TEXT or enum via ::text)
UPDATE "eco_request" SET "status" = 'Approved' WHERE "status"::text = 'Applied';
UPDATE "eco_request" SET "status" = 'Draft' WHERE "status"::text = 'New';
UPDATE "eco_request" SET "status" = 'Reviewed' WHERE "status"::text = 'In Progress';
UPDATE "eco_request" SET "status" = 'Draft' WHERE "status"::text NOT IN ('Draft', 'Reviewed', 'Rejected', 'Approved');

-- Move column to TEXT so we can replace enum type
ALTER TABLE "eco_request" ALTER COLUMN "status" TYPE TEXT USING "status"::text;

DROP TYPE IF EXISTS "EcoRequestStatus";

CREATE TYPE "EcoRequestStatus" AS ENUM ('Draft', 'Reviewed', 'Rejected', 'Approved');

ALTER TABLE "eco_request"
  ALTER COLUMN "status" TYPE "EcoRequestStatus"
  USING ("status"::"EcoRequestStatus");

ALTER TABLE "eco_request"
  ALTER COLUMN "status" SET DEFAULT 'Draft'::"EcoRequestStatus";
