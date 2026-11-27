-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" TEXT;

-- CreateTable
CREATE TABLE "integration_credentials" (
    "provider" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "mock_provider_records" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_provider_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mock_provider_records_provider_kind_idx" ON "mock_provider_records"("provider", "kind");
