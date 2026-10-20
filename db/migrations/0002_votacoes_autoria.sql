-- Autor pode ser parlamentar ou não (ex.: 'Poder Executivo', comissões).
drop table autoria;
create table autoria (
  id             bigint generated always as identity primary key,
  proposicao_id  bigint not null references proposicao(id) on delete cascade,
  parlamentar_id bigint references parlamentar(id) on delete cascade,  -- null se autor não é parlamentar
  nome_autor     text not null,
  tipo_autor     text,                       -- bruto: 'Deputado(a)', 'Órgão do Poder Executivo'...
  proponente     boolean,
  ordem          int,
  url_fonte      text not null,
  unique (proposicao_id, nome_autor)
);
create index on autoria (parlamentar_id);

alter table proposicao
  add column situacao          text,         -- descricaoSituacao bruta da fonte
  add column url_inteiro_teor  text;

-- Uma votação pode afetar mais de uma proposição.
alter table votacao
  drop column proposicao_id,
  add column sigla_orgao text,              -- 'PLEN', comissões...
  add column data date;
create index on votacao (casa_id, sigla_orgao, data desc);

create table votacao_proposicao (
  votacao_id    bigint not null references votacao(id) on delete cascade,
  proposicao_id bigint not null references proposicao(id) on delete cascade,
  primary key (votacao_id, proposicao_id)
);
create index on votacao_proposicao (proposicao_id);

comment on column votacao.tipo is
  'nominal: há voto individual registrado na fonte. simbolica: a fonte não registra voto individual (não é dado faltando).';

alter table autoria enable row level security;
create policy leitura_publica on autoria for select to anon, authenticated using (true);
alter table votacao_proposicao enable row level security;
create policy leitura_publica on votacao_proposicao for select to anon, authenticated using (true);
