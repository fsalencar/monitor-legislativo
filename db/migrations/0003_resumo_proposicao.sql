-- Temas oficiais (palavras-chave da fonte) e resumo em linguagem simples gerado por IA.
-- O resumo é material derivado, não dado da fonte: o site sempre o rotula como gerado por IA
-- e mostra a ementa oficial ao lado.
alter table proposicao
  add column palavras_chave      text,          -- bruto da fonte (lista separada por vírgulas)
  add column resumo_simples      text,
  add column resumo_simples_modelo text,        -- id do modelo que gerou
  add column resumo_simples_em   timestamptz,
  add column resumo_simples_base text;          -- ementa usada para gerar (refaz se a ementa mudar)
