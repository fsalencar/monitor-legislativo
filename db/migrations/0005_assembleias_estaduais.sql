-- Assembleias Legislativas estaduais: começa por São Paulo e Minas Gerais (têm dados abertos).
alter table casa_legislativa drop constraint casa_legislativa_esfera_check;
alter table casa_legislativa add constraint casa_legislativa_esfera_check
  check (esfera in ('federal', 'estadual', 'municipal'));

insert into casa_legislativa (id, nome, esfera, uf, total_cadeiras, url_fonte) values
  ('al-sp', 'Assembleia Legislativa do Estado de São Paulo', 'estadual', 'SP', 94, 'https://www.al.sp.gov.br/dados-abertos/'),
  ('al-mg', 'Assembleia Legislativa de Minas Gerais', 'estadual', 'MG', 77, 'https://dadosabertos.almg.gov.br/')
on conflict (id) do nothing;
