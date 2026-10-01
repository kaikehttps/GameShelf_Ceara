-- CreateEnum
CREATE TYPE "download_source_kind" AS ENUM ('MAGNET', 'TORRENT_FILE');

-- CreateEnum
CREATE TYPE "download_status" AS ENUM ('QUEUED', 'METADATA', 'DOWNLOADING', 'PAUSED', 'CHECKING', 'COMPLETED', 'CANCELED', 'ERROR');

-- CreateTable
CREATE TABLE "download_sources" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "kind" "download_source_kind" NOT NULL,
    "reference" VARCHAR(4096) NOT NULL,
    "torrent_file" BYTEA,
    "info_hash" CHAR(40) NOT NULL,
    "size_bytes" BIGINT,
    "origin" VARCHAR(500) NOT NULL,
    "license" VARCHAR(200) NOT NULL,
    "authorization_note" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "download_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "info_hash" CHAR(40) NOT NULL,
    "active_info_hash" CHAR(40),
    "status" "download_status" NOT NULL DEFAULT 'QUEUED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "downloaded_bytes" BIGINT NOT NULL DEFAULT 0,
    "total_bytes" BIGINT,
    "add_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "canceled_at" TIMESTAMPTZ(3),
    "files_deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "download_sources_info_hash_key" ON "download_sources"("info_hash");

-- CreateIndex
CREATE INDEX "download_sources_game_id_idx" ON "download_sources"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "downloads_active_info_hash_key" ON "downloads"("active_info_hash");

-- CreateIndex
CREATE INDEX "downloads_user_id_created_at_idx" ON "downloads"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "downloads_status_idx" ON "downloads"("status");

-- AddForeignKey
ALTER TABLE "download_sources" ADD CONSTRAINT "download_sources_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "download_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restrições escritas à mão (o Prisma não expressa CHECK).

-- Fontes: info hash v1 normalizado; magnet é magnet; .torrent tem conteúdo (até 2 MiB).
ALTER TABLE "download_sources" ADD CONSTRAINT "download_sources_info_hash_format_check" CHECK ("info_hash" ~ '^[0-9a-f]{40}$');
ALTER TABLE "download_sources" ADD CONSTRAINT "download_sources_kind_check" CHECK (
  ("kind" = 'MAGNET' AND "reference" LIKE 'magnet:?%' AND "torrent_file" IS NULL)
  OR ("kind" = 'TORRENT_FILE' AND "torrent_file" IS NOT NULL AND octet_length("torrent_file") <= 2097152)
);
ALTER TABLE "download_sources" ADD CONSTRAINT "download_sources_size_check" CHECK ("size_bytes" IS NULL OR "size_bytes" > 0);
ALTER TABLE "download_sources" ADD CONSTRAINT "download_sources_license_not_blank_check" CHECK (btrim("license") <> '' AND btrim("origin") <> '');

-- Downloads: o "slot" ativo é sempre o próprio info hash; cancelado nunca ocupa o slot.
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_active_info_hash_check" CHECK ("active_info_hash" IS NULL OR "active_info_hash" = "info_hash");
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_canceled_check" CHECK (("status" = 'CANCELED') = ("canceled_at" IS NOT NULL) AND ("status" <> 'CANCELED' OR "active_info_hash" IS NULL));
-- Concluído só com 100% e data de conclusão: impede marcar como concluído por engano.
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_completed_check" CHECK ("status" <> 'COMPLETED' OR ("progress" = 1 AND "completed_at" IS NOT NULL));
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_progress_check" CHECK ("progress" BETWEEN 0 AND 1 AND "downloaded_bytes" >= 0 AND ("total_bytes" IS NULL OR "total_bytes" >= 0) AND "add_attempts" >= 0);
-- Arquivos só são apagados depois do cancelamento (a tarefa já saiu do cliente).
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_files_deleted_check" CHECK ("files_deleted_at" IS NULL OR "status" = 'CANCELED');
