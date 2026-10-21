-- Busca de proposições por palavras da ementa, sem diferenciar acentos nem maiúsculas.
create extension if not exists unaccent schema public;
create extension if not exists pg_trgm schema public;

-- unaccent não é imutável (depende do dicionário); este invólucro fixa o dicionário para poder indexar.
create or replace function public.sem_acento(texto text) returns text
  language sql immutable parallel safe strict
  as $$ select lower(public.unaccent('public.unaccent'::regdictionary, texto)) $$;

create index if not exists proposicao_ementa_trgm on proposicao using gin (public.sem_acento(ementa) public.gin_trgm_ops);
