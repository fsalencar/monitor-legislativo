-- Mais Assembleias Legislativas: as que publicam a lista de deputados em dados abertos.
-- AM, PB, RO, AC, RR e TO usam o SAPL (Interlegis), que também tem matérias, votos e presença.
-- ES e PE publicam só a lista de deputados (nome e partido).
insert into casa_legislativa (id, nome, esfera, uf, total_cadeiras, url_fonte) values
  ('al-am', 'Assembleia Legislativa do Estado do Amazonas', 'estadual', 'AM', 24, 'https://sapl.al.am.leg.br/api/'),
  ('al-pb', 'Assembleia Legislativa do Estado da Paraíba', 'estadual', 'PB', 36, 'https://sapl.al.pb.leg.br/api/'),
  ('al-ro', 'Assembleia Legislativa do Estado de Rondônia', 'estadual', 'RO', 24, 'https://sapl.al.ro.leg.br/api/'),
  ('al-ac', 'Assembleia Legislativa do Estado do Acre', 'estadual', 'AC', 24, 'https://sapl.al.ac.leg.br/api/'),
  ('al-rr', 'Assembleia Legislativa do Estado de Roraima', 'estadual', 'RR', 24, 'https://sapl.al.rr.leg.br/api/'),
  ('al-to', 'Assembleia Legislativa do Estado do Tocantins', 'estadual', 'TO', 24, 'https://sapl.al.to.leg.br/api/'),
  ('al-es', 'Assembleia Legislativa do Estado do Espírito Santo', 'estadual', 'ES', 30, 'https://www.al.es.gov.br/Transparencia/DadosAbertos'),
  ('al-pe', 'Assembleia Legislativa do Estado de Pernambuco', 'estadual', 'PE', 49, 'https://dadosabertos.alepe.pe.gov.br/')
on conflict (id) do nothing;
