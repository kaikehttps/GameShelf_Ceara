-- CreateEnum
CREATE TYPE "refresh_token_revocation_reason" AS ENUM ('ROTATED', 'LOGOUT', 'REUSE_DETECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "bio" VARCHAR(280),
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "session_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" "refresh_token_revocation_reason",
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de integridade escritas à mão (o schema do Prisma não expressa CHECK).
-- Elas valem mesmo que algum código ignore a validação da API.

-- E-mail sempre normalizado, para a restrição UNIQUE não ser contornada com maiúsculas.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "users" ADD CONSTRAINT "users_display_name_length_check" CHECK (char_length(btrim("display_name")) >= 2);

-- A expiração por inatividade nunca ultrapassa a expiração absoluta da sessão.
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_expiry_check" CHECK ("expires_at" <= "session_expires_at");
-- Token revogado sempre tem motivo, e vice-versa.
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_revocation_check" CHECK (("revoked_at" IS NULL) = ("revoked_reason" IS NULL));
