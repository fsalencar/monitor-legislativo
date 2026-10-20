// Dados para receber contribuições. Enquanto vazios, a página mostra "em breve".
// São dados públicos por natureza (aparecem na página para quem quiser doar).

/** Chave Pix (e-mail, telefone, CNPJ/CPF ou chave aleatória). */
export const CHAVE_PIX: string | null = "81e68cd6-af07-4089-85de-5310ce775afd";

/** Nome que aparece para quem paga o Pix (titular da conta). */
export const TITULAR_PIX: string | null = null;

/** Link de pagamento (cartão e Pix pelo Mercado Pago). */
export const LINK_APOIO: { url: string; nome: string } | null = {
  url: "https://link.mercadopago.com.br/monitorlegislativo",
  nome: "Mercado Pago",
};
