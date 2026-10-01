-- Trigramas para a busca por trecho do nome (índice games_name_trgm_idx, abaixo).
-- pg_trgm é uma extensão "trusted": o dono do banco pode criá-la sem ser superusuário.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "catalog_provider" AS ENUM ('STEAM', 'EPIC', 'LAUNCHBOX');

-- CreateEnum
CREATE TYPE "library_status" AS ENUM ('WANT_TO_PLAY', 'PLAYING', 'COMPLETED', 'ABANDONED');

-- Os nomes usam a collation ICU "und-x-icu" (escrita à mão; o Prisma não expressa COLLATE).
-- Sem ela, a ordem alfabética depende do locale com que o servidor foi criado: com "C"
-- (padrão da imagem Alpine) a comparação é por bytes e "Ação" fica depois de "Aventura",
-- "Ábaco" depois de "Zelda" e "de Blob" depois de todos os nomes com maiúscula.

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "name" VARCHAR(300) COLLATE "und-x-icu" NOT NULL,
    "description" TEXT,
    "cover_url" VARCHAR(2048),
    "release_date" DATE,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,
    "rating_average" DECIMAL(3,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_external_ids" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "provider" "catalog_provider" NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_external_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) COLLATE "und-x-icu" NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_genres" (
    "game_id" UUID NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "game_genres_pkey" PRIMARY KEY ("game_id","genre_id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) COLLATE "und-x-icu" NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_platforms" (
    "game_id" UUID NOT NULL,
    "platform_id" INTEGER NOT NULL,

    CONSTRAINT "game_platforms_pkey" PRIMARY KEY ("game_id","platform_id")
);

-- CreateTable
CREATE TABLE "library_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "status" "library_status" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "library_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_name_idx" ON "games"("name");

-- CreateIndex
CREATE INDEX "games_name_trgm_idx" ON "games" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "games_release_date_idx" ON "games"("release_date");

-- CreateIndex
CREATE INDEX "games_rating_average_idx" ON "games"("rating_average");

-- CreateIndex
CREATE UNIQUE INDEX "game_external_ids_provider_external_id_key" ON "game_external_ids"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_external_ids_game_id_provider_key" ON "game_external_ids"("game_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "game_genres_genre_id_idx" ON "game_genres"("genre_id");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE INDEX "game_platforms_platform_id_idx" ON "game_platforms"("platform_id");

-- CreateIndex
CREATE INDEX "library_entries_user_id_updated_at_idx" ON "library_entries"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "library_entries_game_id_idx" ON "library_entries"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_entries_user_id_game_id_key" ON "library_entries"("user_id", "game_id");

-- CreateIndex
CREATE INDEX "reviews_game_id_created_at_idx" ON "reviews"("game_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_game_id_key" ON "reviews"("user_id", "game_id");

-- AddForeignKey
ALTER TABLE "game_external_ids" ADD CONSTRAINT "game_external_ids_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_genres" ADD CONSTRAINT "game_genres_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_genres" ADD CONSTRAINT "game_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de integridade escritas à mão (o schema do Prisma não expressa CHECK nem trigger).

-- Catálogo
ALTER TABLE "games" ADD CONSTRAINT "games_name_not_blank_check" CHECK (btrim("name") <> '');
ALTER TABLE "games" ADD CONSTRAINT "games_cover_url_https_check" CHECK ("cover_url" ~ '^https://');
ALTER TABLE "game_external_ids" ADD CONSTRAINT "game_external_ids_external_id_not_blank_check" CHECK (btrim("external_id") <> '');
ALTER TABLE "genres" ADD CONSTRAINT "genres_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Avaliações: nota inteira de 1 a 5 e comentário nulo ou com conteúdo.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_comment_not_blank_check" CHECK (btrim("comment") <> '');

-- Agregados coerentes entre si: sem avaliações não há média; com avaliações, a soma
-- fica entre 1×quantidade e 5×quantidade.
ALTER TABLE "games" ADD CONSTRAINT "games_rating_aggregates_check" CHECK (
  "rating_count" >= 0
  AND "rating_sum" BETWEEN "rating_count" AND 5 * "rating_count"
  AND ("rating_average" IS NULL) = ("rating_count" = 0)
);

-- Média e quantidade de avaliações mantidas pelo próprio banco.
--
-- Cada INSERT/UPDATE/DELETE em "reviews" aplica a diferença (delta) nos agregados do
-- jogo, no mesmo comando e na mesma transação. Assim os números ficam corretos mesmo
-- com avaliações simultâneas (o UPDATE em "games" bloqueia a linha do jogo e soma sobre
-- o valor mais recente) e mesmo se alguém alterar "reviews" sem passar pela API.
CREATE FUNCTION "apply_game_rating_delta"(p_game_id UUID, p_count_delta INTEGER, p_sum_delta INTEGER)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE "games"
  SET "rating_count" = "rating_count" + p_count_delta,
      "rating_sum" = "rating_sum" + p_sum_delta,
      -- No SET, as colunas à direita têm os valores anteriores ao UPDATE.
      "rating_average" = CASE
        WHEN "rating_count" + p_count_delta = 0 THEN NULL
        ELSE round(("rating_sum" + p_sum_delta)::numeric / ("rating_count" + p_count_delta), 2)
      END
  WHERE "id" = p_game_id;
$$;

CREATE FUNCTION "reviews_sync_game_rating"() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM "apply_game_rating_delta"(NEW."game_id", 1, NEW."rating");
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM "apply_game_rating_delta"(OLD."game_id", -1, -OLD."rating");
  ELSIF NEW."game_id" = OLD."game_id" THEN
    PERFORM "apply_game_rating_delta"(NEW."game_id", 0, NEW."rating" - OLD."rating");
  ELSE
    -- A API nunca move uma avaliação de jogo, mas o banco não depende disso.
    PERFORM "apply_game_rating_delta"(OLD."game_id", -1, -OLD."rating");
    PERFORM "apply_game_rating_delta"(NEW."game_id", 1, NEW."rating");
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "reviews_sync_game_rating"
AFTER INSERT OR DELETE OR UPDATE OF "rating", "game_id" ON "reviews"
FOR EACH ROW EXECUTE FUNCTION "reviews_sync_game_rating"();
