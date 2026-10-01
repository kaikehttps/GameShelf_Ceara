-- AlterTable
ALTER TABLE "games" ADD COLUMN     "banner_url" VARCHAR(2048);

-- Mesma regra da capa: só https, porque a URL vai direto para o frontend.
ALTER TABLE "games" ADD CONSTRAINT "games_banner_url_https_check" CHECK ("banner_url" ~ '^https://');
