-- CreateEnum
CREATE TYPE "oauth_client_auth_method" AS ENUM ('client_secret_basic', 'client_secret_post');

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" VARCHAR(100) NOT NULL,
    "client_secret_hash" VARCHAR(255) NOT NULL,
    "client_name" VARCHAR(100) NOT NULL,
    "grant_types" JSON NOT NULL,
    "redirect_uris" JSON NOT NULL,
    "allowed_scopes" JSON NOT NULL,
    "auth_method" "oauth_client_auth_method" NOT NULL DEFAULT 'client_secret_basic',
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(255) NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "redirect_uri" VARCHAR(500) NOT NULL,
    "scope" VARCHAR(255),
    "code_challenge" VARCHAR(255),
    "code_challenge_method" VARCHAR(20),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token_jti" VARCHAR(255) NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "scope" VARCHAR(255),
    "access_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");

-- CreateIndex
CREATE INDEX "idx_oauth_clients_id" ON "oauth_clients"("id");

-- CreateIndex
CREATE INDEX "idx_oauth_clients_client_id" ON "oauth_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorization_codes_code_key" ON "oauth_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "idx_oauth_codes_code" ON "oauth_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "idx_oauth_codes_client" ON "oauth_authorization_codes"("client_id");

-- CreateIndex
CREATE INDEX "idx_oauth_codes_user" ON "oauth_authorization_codes"("user_id");

-- CreateIndex
CREATE INDEX "idx_oauth_tokens_client" ON "oauth_tokens"("client_id");

-- CreateIndex
CREATE INDEX "idx_oauth_tokens_user" ON "oauth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_oauth_tokens_jti" ON "oauth_tokens"("access_token_jti");

-- CreateIndex
CREATE INDEX "idx_oauth_tokens_user_client" ON "oauth_tokens"("user_id", "client_id");

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
