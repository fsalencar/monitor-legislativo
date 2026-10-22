-- Busca de proposições por índice de texto (palavras e começo de palavras: "tribut" acha "tributário"),
-- no lugar do índice de trigramas: mesmo resultado prático em ~1/4 do espaço (9,6 MB x 35 MB).
create index if not exists proposicao_ementa_fts on proposicao using gin (to_tsvector('simple', public.sem_acento(ementa)));
drop index if exists proposicao_ementa_trgm;
