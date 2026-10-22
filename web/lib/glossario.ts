// Significado dos valores de voto que não são autoexplicativos (regimentos da Câmara e do Senado).
// Só códigos cujo significado está documentado pela fonte; os demais aparecem como vieram.
export const GLOSSARIO: Record<string, string> = {
  "Artigo 17": "Quem preside a sessão não vota, salvo para desempatar (Regimento Interno da Câmara, art. 17).",
  Obstrução: "O parlamentar marcou presença em obstrução, recurso regimental que não conta para o quórum da votação.",
  Abstenção: "O parlamentar registrou presença sem votar Sim nem Não.",
  "Presidente (art. 51 RISF)": "Quem preside a sessão não vota, salvo para desempatar (Regimento Interno do Senado, art. 51).",
  Votou: "Votação secreta: o Senado registra apenas que o senador votou, não o voto.",
  "P-NRV": "Presente, mas não registrou voto.",
  NCom: "Não compareceu.",
  AP: "Ausente por atividade parlamentar.",
  MIS: "Ausente em missão oficial.",
  LS: "Em licença para tratamento de saúde.",
  LP: "Em licença particular.",
  Licenciado: "O deputado estava licenciado do mandato na data da votação (ALESP).",
  "Sem voto registrado": "O relatório oficial da votação não traz voto do deputado (ALESP).",
  Presidente: "Quem preside a sessão; aparece sem voto no relatório oficial da votação (ALESP).",
  Branco: "Voto em branco na cédula de votação de vetos do Congresso.",
  "Não Votou": "O sistema de votação da Assembleia (SAPL) registrou o deputado sem voto nesta votação.",
};
