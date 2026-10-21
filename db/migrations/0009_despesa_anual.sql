-- Gastos da cota em anos anteriores ao detalhamento mensal (antes de 2023): só o total por ano,
-- para o "total em todos os mandatos" do perfil sem ocupar espaço com o detalhe antigo.
create table despesa_anual (
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  ano            int not null,
  valor          numeric(14, 2) not null,
  documentos     int not null,
  primary key (parlamentar_id, ano)
);
