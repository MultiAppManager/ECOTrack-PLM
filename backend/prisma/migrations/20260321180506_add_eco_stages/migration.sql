-- AlterTable
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'Operations User';

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL,
    "salePrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "costPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "versionDiff" JSONB,
    "priceDifference" DECIMAL(15,2),
    "itemDifference" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_of_materials" (
    "id" TEXT NOT NULL,
    "bomCode" TEXT NOT NULL DEFAULT '',
    "name" VARCHAR(255) NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "components" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "versionDiff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_request" (
    "id" TEXT NOT NULL,
    "ecoCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ecoType" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "bom" TEXT NOT NULL,
    "productId" TEXT,
    "bomId" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "versionUpdate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "stageId" TEXT,
    "stageStatus" TEXT NOT NULL DEFAULT 'open',
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eco_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_stage" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eco_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_stage_approval" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Required',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eco_stage_approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_productCode_idx" ON "product"("productCode");

-- CreateIndex
CREATE INDEX "product_status_idx" ON "product"("status");

-- CreateIndex
CREATE INDEX "product_isLatest_idx" ON "product"("isLatest");

-- CreateIndex
CREATE INDEX "bill_of_materials_bomCode_idx" ON "bill_of_materials"("bomCode");

-- CreateIndex
CREATE INDEX "bill_of_materials_productCode_idx" ON "bill_of_materials"("productCode");

-- CreateIndex
CREATE INDEX "bill_of_materials_status_idx" ON "bill_of_materials"("status");

-- CreateIndex
CREATE INDEX "bill_of_materials_isLatest_idx" ON "bill_of_materials"("isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "eco_request_ecoCode_key" ON "eco_request"("ecoCode");

-- CreateIndex
CREATE INDEX "eco_request_status_idx" ON "eco_request"("status");

-- CreateIndex
CREATE INDEX "eco_request_stageId_idx" ON "eco_request"("stageId");

-- CreateIndex
CREATE INDEX "eco_request_createdAt_idx" ON "eco_request"("createdAt");

-- CreateIndex
CREATE INDEX "eco_request_productId_idx" ON "eco_request"("productId");

-- CreateIndex
CREATE INDEX "eco_request_bomId_idx" ON "eco_request"("bomId");

-- CreateIndex
CREATE INDEX "eco_stage_sequence_idx" ON "eco_stage"("sequence");

-- CreateIndex
CREATE INDEX "eco_stage_approval_stageId_idx" ON "eco_stage_approval"("stageId");

-- AddForeignKey
ALTER TABLE "eco_stage_approval" ADD CONSTRAINT "eco_stage_approval_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "eco_stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
