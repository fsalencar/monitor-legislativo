-- Gastos das cotas/verbas parlamentares: total por parlamentar, mês e categoria (fonte oficial de
-- cada casa). Não guarda nota a nota nem fornecedores (CPF de pessoas físicas): o site leva às notas
-- na fonte oficial.
create table despesa_mensal (
  parlamentar_id bigint not null references parlamentar(id) on delete cascade,
  ano            int not null,
  mes            int not null check (mes between 1 and 12),
  categoria      text not null,
  valor          numeric(14, 2) not null,
  documentos     int not null,
  primary key (parlamentar_id, ano, mes, categoria)
);
