-- AlterTable
ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "password" SET DEFAULT '';
