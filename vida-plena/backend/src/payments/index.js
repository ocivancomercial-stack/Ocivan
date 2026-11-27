'use strict';

// Pagamento com cartão. O app NUNCA manda o número do cartão para este servidor:
// ele tokeniza o cartão direto no gateway (SDK do Pagar.me, Stripe, Mercado Pago...)
// e envia só o token. Assim este servidor fica fora do escopo pesado do PCI-DSS.
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

function gateway(config) {
  if (!config.gatewayApiKey) throw new Error('PAYMENTS=gateway exige GATEWAY_API_KEY');
  // TODO: implementar com o SDK/REST do gateway escolhido.
  // Mensal: criar assinatura (cobrança recorrente). Anual: cobrança única parcelada.
  return {
    nome: 'gateway',
    async cobrar() { throw Object.assign(new Error('Gateway de pagamento ainda não implementado'), { status: 501 }); },
    async estornar() { throw Object.assign(new Error('Gateway de pagamento ainda não implementado'), { status: 501 }); },
  };
}

module.exports = config => (config.payments === 'gateway' ? gateway(config) : mock());
