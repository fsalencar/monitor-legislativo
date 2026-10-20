-- Modelo unificado entre casas legislativas.
-- Toda linha vinda de fonte oficial guarda id_fonte + url_fonte.
-- Valores categóricos (voto, situação, motivo) ficam como texto bruto da fonte.

create table casa_legislativa (
  id          text primary key,           -- 'camara', 'senado', 'congresso', 'cm-sao-paulo'
  nome        text not null,
  esfera      text not null check (esfera in ('federal', 'municipal')),
  municipio   text,
  uf          text,
  total_cadeiras int,
  url_fonte   text not null
);

insert into casa_legislativa (id, nome, esfera, total_cadeiras, url_fonte) values
  ('camara',    'Câmara dos Deputados', 'federal', 513, 'https://dadosabertos.camara.leg.br'),
  ('senado',    'Senado Federal',       'federal',  81, 'https://legis.senado.leg.br/dadosabertos'),
  ('congresso', 'Congresso Nacional',   'federal', null, 'https://legis.senado.leg.br/dadosabertos');

create table legislatura (
  casa_id     text not null references casa_legislativa(id),
  numero      int  not null,
  data_inicio date not null,
  data_fim    date,
  url_fonte   text not null,
  primary key (casa_id, numero)
);

create table parlamentar (
  id                   bigint generated always as identity primary key,
  casa_id              text not null references casa_legislativa(id),
  id_fonte             text not null,
  nome                 text not null,       -- nome parlamentar
  nome_civil           text,
  sexo                 text,
  data_nascimento      date,
  uf_nascimento        text,
  municipio_nascimento text,
  url_foto             text,
  url_fonte            text not null,
  atualizado_em        timestamptz not null default now(),
  unique (casa_id, id_fonte)
);

-- Um registro por legislatura em que o parlamentar exerceu.
create table mandato (
  id             bigint generated always as identity primary key,
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  casa_id        text   not null,
  legislatura    int    not null,
  sigla_partido  text,
  uf             text,
  em_exercicio   boolean not null default false,
  situacao       text,                       -- bruto da fonte ('Exercício', 'Fim de Mandato'...)
  condicao       text,                       -- 'Titular', 'Suplente'
  url_fonte      text not null,
  atualizado_em  timestamptz not null default now(),
  unique (parlamentar_id, legislatura),
  foreign key (casa_id, legislatura) references legislatura(casa_id, numero)
);
create index on mandato (casa_id, em_exercicio) where em_exercicio;

create table proposicao (
  id             bigint generated always as identity primary key,
  casa_id        text not null references casa_legislativa(id),
  id_fonte       text not null,
  sigla_tipo     text not null,              -- PL, PEC, MPV...
  numero         int,
  ano            int,
  ementa         text,
  data_apresentacao date,
  url_fonte      text not null,
  atualizado_em  timestamptz not null default now(),
  unique (casa_id, id_fonte)
);
create index on proposicao (sigla_tipo, numero, ano);

create table autoria (
  proposicao_id  bigint not null references proposicao(id) on delete cascade,
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  proponente     boolean,
  ordem          int,
  primary key (proposicao_id, parlamentar_id)
);
create index on autoria (parlamentar_id);

create table votacao (
  id             bigint generated always as identity primary key,
  casa_id        text not null references casa_legislativa(id),
  id_fonte       text not null,
  proposicao_id  bigint references proposicao(id),
  data_hora      timestamptz,
  descricao      text,
  -- 'nominal' tem voto individual; 'simbolica' não registra voto individual (não é dado faltando).
  tipo           text not null check (tipo in ('nominal', 'simbolica')),
  aprovacao      boolean,
  url_fonte      text not null,
  atualizado_em  timestamptz not null default now(),
  unique (casa_id, id_fonte)
);
create index on votacao (proposicao_id);
create index on votacao (data_hora desc);

create table voto (
  votacao_id     bigint not null references votacao(id) on delete cascade,
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  voto           text not null,              -- bruto: 'Sim', 'Não', 'Abstenção', 'Obstrução', 'Artigo 17'...
  sigla_partido  text,                       -- partido no momento do voto
  uf             text,
  primary key (votacao_id, parlamentar_id)
);
create index on voto (parlamentar_id);

create table sessao (
  id             bigint generated always as identity primary key,
  casa_id        text not null references casa_legislativa(id),
  id_fonte       text not null,
  data_inicio    timestamptz,
  tipo           text,
  deliberativa   boolean,
  url_fonte      text not null,
  unique (casa_id, id_fonte)
);

create table presenca (
  sessao_id      bigint not null references sessao(id) on delete cascade,
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  situacao       text not null,              -- bruto: presença, falta justificada, ausência...
  justificativa  text,
  primary key (sessao_id, parlamentar_id)
);
create index on presenca (parlamentar_id);

create table afastamento (
  id             bigint generated always as identity primary key,
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  data_inicio    date not null,
  data_fim       date,
  motivo         text,                       -- bruto da fonte (licença, missão, cargo no executivo...)
  url_fonte      text not null,
  unique (parlamentar_id, data_inicio, motivo)
);

-- Registro de execuções da ingestão (página de transparência / depuração).
create table ingestao_execucao (
  id           bigint generated always as identity primary key,
  job          text not null,
  iniciado_em  timestamptz not null default now(),
  finalizado_em timestamptz,
  ok           boolean,
  registros    int,
  erro         text
);

-- Leitura pública (anon) via Supabase; escrita apenas pela conexão da ingestão.
do $$
declare t text;
begin
  foreach t in array array['casa_legislativa','legislatura','parlamentar','mandato','proposicao',
                           'autoria','votacao','voto','sessao','presenca','afastamento']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy leitura_publica on %I for select to anon, authenticated using (true)', t);
  end loop;
  execute 'alter table ingestao_execucao enable row level security';
end $$;
