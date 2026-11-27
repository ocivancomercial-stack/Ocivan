'use strict';

// SIMULAÇÃO da API da seguradora. Preços e regras são fictícios,
// iguais aos do protótipo do app, só para desenvolver e testar o fluxo.

const crypto = require('node:crypto');

const PROF = { admin: 1, saude: 1.15, campo: 1.4, risco: 1.8 };

function idade(nasc, hoje = new Date()) {
  const d = new Date(nasc + 'T12:00:00');
  let a = hoje.getFullYear() - d.getFullYear();
  if (hoje < new Date(hoje.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}
const r2 = v => Math.round(v * 100) / 100;

module.exports = function mockInsurer(config) {
  const propostas = new Map();

  return {
    nome: 'tokio-mock',

    async cotar(e) {
      const a = idade(e.nascimento);
      const fa = Math.exp(0.075 * (a - 30)), fs = e.sexo === 'F' ? 0.85 : 1,
        ff = e.fumante ? 1.6 : 1, fp = PROF[e.profissao];
      const itens = e.coberturas.map(c => {
        let p = 0;
        if (c.id === 'morte') p = c.capital / 1000 * 0.11 * fa * fs * ff;
        if (c.id === 'ipa') p = c.capital / 1000 * 0.035 * fp;
        if (c.id === 'dg') p = c.capital / 1000 * 0.16 * fa * ff;
        if (c.id === 'ma') p = c.capital / 1000 * 0.025 * fp;
        if (c.id === 'dit') p = c.capital * 0.34 * fp * (1 + Math.max(0, a - 40) * 0.02);
        if (c.id === 'fun') p = 6.9;
        return { cobertura: c.id, capital: c.capital, premio: r2(p) };
      });
      const liquido = r2(Math.max(itens.reduce((s, x) => s + x.premio, 0), 25));
      const iof = r2(liquido * config.iof);
      const mensal = r2(liquido + iof);
      return {
        idCotacao: 'COT-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
        idade: a,
        itens,
        premioLiquido: liquido,
        iof,
        premioMensal: mensal,
        premioAnual: r2(mensal * 12 * (1 - config.descontoAnual)),
        validaAte: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        comissaoMaxima: 35, // limite de corretagem do produto (a confirmar com a Tokio)
      };
    },

    async emitirProposta(p) {
      const numero = 'PRP-' + crypto.randomBytes(5).toString('hex').toUpperCase();
      const status = p.declaracaoSaude.some(Boolean) ? 'EM_ANALISE_SUBSCRICAO' : 'ACEITA';
      propostas.set(numero, { status });
      return { numeroProposta: numero, status };
    },

    async renovar({ numeroProposta }) {
      const p = propostas.get(numeroProposta);
      if (p && p.status === 'CANCELADA') return { status: 'NAO_RENOVADA', motivo: 'Apólice cancelada' };
      return { status: 'RENOVADA' };
    },

    async consultarProposta(numero) {
      const p = propostas.get(numero);
      return p ? { numeroProposta: numero, ...p } : null;
    },
  };
};

module.exports.idade = idade;
