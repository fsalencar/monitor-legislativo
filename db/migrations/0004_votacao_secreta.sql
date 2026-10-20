-- O Senado tem votações secretas: não registram voto individual e não são simbólicas.
alter table votacao drop constraint votacao_tipo_check;
alter table votacao add constraint votacao_tipo_check check (tipo in ('nominal', 'simbolica', 'secreta'));

comment on column votacao.tipo is
  'nominal: há voto individual registrado na fonte. simbolica: a fonte não registra voto individual (não é dado faltando). secreta: votação secreta (Senado), sem voto individual por definição.';
