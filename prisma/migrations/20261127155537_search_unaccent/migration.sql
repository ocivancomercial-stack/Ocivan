-- Busca textual sem acentos ("tenis" encontra "Tênis") e com prefixo ("jaq" encontra "jaqueta").
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE; o wrapper permite usá-la em índice.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE OR REPLACE FUNCTION product_search_vector(title text, description text) RETURNS tsvector
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(description, ''))), 'B') $$;

DROP INDEX IF EXISTS "products_search_fts";
CREATE INDEX "products_search_fts" ON "products" USING GIN (product_search_vector("title", "description"));
