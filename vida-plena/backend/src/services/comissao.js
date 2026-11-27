'use strict';

// Programa de comissão: percentual único (padrão 30%) em todos os casos.
//
// Regras:
// - Base de cálculo: prêmio líquido (sem IOF) de cada pagamento aprovado.
//   Mensal: uma comissão por mensalidade paga. Anual: uma comissão sobre o prêmio anual.
// - O percentual é gravado na proposta no momento da contratação. Mudar a
//   configuração depois não altera comissões já geradas.
// - Status:
//     PREVISTA  -> pagamento aprovado, proposta ainda em análise da seguradora
//     A_RECEBER -> proposta aceita / apólice emitida; aguardando repasse da seguradora
//     RECEBIDA  -> repasse conferido (marcado pelo admin)
//     CANCELADA -> proposta recusada ou pagamento estornado

const r2 = v => Math.round(v * 100) / 100;

function calcular(baseCalculo, percentual) {
  return { base_calculo: r2(baseCalculo), percentual, valor: r2(baseCalculo * percentual / 100) };
}

function statusInicial(statusProposta) {
  return ['ACEITA', 'APOLICE_EMITIDA'].includes(statusProposta) ? 'A_RECEBER' : 'PREVISTA';
}

// Atualiza as comissões quando a seguradora muda o status da proposta.
// db: banco ou transação de ./db (get/all/run assíncronos).
async function aoMudarStatusProposta(db, numero, novoStatus) {
  if (['ACEITA', 'APOLICE_EMITIDA'].includes(novoStatus)) {
    await db.run(`UPDATE comissoes SET status='A_RECEBER' WHERE proposta_numero=? AND status='PREVISTA'`, numero);
  }
  if (['RECUSADA', 'CANCELADA'].includes(novoStatus)) {
    await db.run(`UPDATE comissoes SET status='CANCELADA' WHERE proposta_numero=? AND status IN ('PREVISTA','A_RECEBER')`, numero);
  }
}

module.exports = { calcular, statusInicial, aoMudarStatusProposta, r2 };
