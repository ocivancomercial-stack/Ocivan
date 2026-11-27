'use strict';

// Pagamento com cartão. A cobrança é feita pela plataforma da Tokio Marine (PAYMENTS=tokio),
// depois da integração com a API dela. Até lá, roda a simulação (PAYMENTS=mock).
//
// O app NUNCA manda o número do cartão para este servidor: ele tokeniza o cartão no
// navegador (SDK/checkout da Tokio) e envia só o token. Assim este servidor fica fora
// do escopo pesado do PCI-DSS.
//
// Interface:
//   cobrar({ token, valor, parcelas, recorrente, descricao, referencia })
//     -> { status: 'APROVADO'|'RECUSADO', autorizacao?, cartaoFinal?, bandeira?, motivo? }
//   estornar({ autorizacao, valor }) -> { status: 'ESTORNADO' }

const crypto = require('node:crypto');

function mock() {
  // Tokens de teste: tok_aprova_4111 (aprova), tok_recusa_0002 (recusa).
  return {
    nome: 'mock',
    async cobrar({ token, parcelas }) {
      if (!/^tok_/.test(token)) return { status: 'RECUSADO', motivo: 'Token de cartão inválido' };
      if (token.includes('recusa')) return { status: 'RECUSADO', motivo: 'Transação não autorizada pelo emissor', cartaoFinal: '0002', bandeira: 'VISA' };
      return { status: 'APROVADO', autorizacao: crypto.randomBytes(3).toString('hex').toUpperCase(), cartaoFinal: '1111', bandeira: 'VISA', parcelas };
    },
    async estornar() { return { status: 'ESTORNADO' }; },
  };
}

// Cobrança pela Tokio: usa a mesma conexão autenticada da integração da seguradora.
// As cobranças seguintes (mensalidades, anuidades, renovações) chegam pelo
// webhook /api/webhooks/pagamentos, e cada uma aprovada gera a comissão.
function tokio(insurer) {
  if (!insurer || typeof insurer.cobrar !== 'function') {
    throw new Error('PAYMENTS=tokio exige INSURER=tokio (a cobrança usa a API da Tokio Marine)');
  }
  return {
    nome: 'tokio',
    cobrar: dados => insurer.cobrar(dados),
    estornar: dados => insurer.estornar(dados),
  };
}

module.exports = (config, { insurer } = {}) => {
  if (config.payments === 'tokio') return tokio(insurer);
  if (config.payments !== 'mock') throw new Error(`PAYMENTS inválido: "${config.payments}" (use "mock" ou "tokio")`);
  return mock();
};
