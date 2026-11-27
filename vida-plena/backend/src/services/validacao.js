'use strict';

const { idade } = require('../insurer/tokioMarine.mock');

class ErroValidacao extends Error {
  constructor(msg) { super(msg); this.status = 422; }
}
const falha = msg => { throw new ErroValidacao(msg); };

const COBERTURAS = {
  morte: { min: 50000, max: 1000000, obrigatoria: true },
  ipa: { min: 20000, max: 1000000 },
  dg: { min: 20000, max: 500000 },
  ma: { min: 20000, max: 1000000 },
  dit: { min: 50, max: 500 },
  fun: { min: 7000, max: 7000 },
};
const PROFISSOES = ['admin', 'saude', 'campo', 'risco'];

function cpfValido(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}

function cotacao(b) {
  if (!b || typeof b !== 'object') falha('Corpo da requisição inválido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.nascimento || '')) falha('nascimento deve estar no formato AAAA-MM-DD');
  const a = idade(b.nascimento);
  if (!(a >= 18 && a <= 65)) falha('Este produto aceita idades de 18 a 65 anos');
  if (!['F', 'M'].includes(b.sexo)) falha('sexo deve ser F ou M');
  if (typeof b.fumante !== 'boolean') falha('fumante deve ser true ou false');
  if (!PROFISSOES.includes(b.profissao)) falha('profissao inválida');
  if (!/^[A-Z]{2}$/.test(b.uf || '')) falha('uf inválida');
  if (!Array.isArray(b.coberturas) || !b.coberturas.length) falha('Informe as coberturas');
  const vistos = new Set();
  for (const c of b.coberturas) {
    const regra = COBERTURAS[c && c.id];
    if (!regra) falha(`Cobertura desconhecida: ${c && c.id}`);
    if (vistos.has(c.id)) falha(`Cobertura repetida: ${c.id}`);
    vistos.add(c.id);
    if (!(Number.isFinite(c.capital) && c.capital >= regra.min && c.capital <= regra.max)) falha(`Capital de ${c.id} fora do limite (${regra.min} a ${regra.max})`);
  }
  if (!vistos.has('morte')) falha('A cobertura de morte é obrigatória');
  return { nascimento: b.nascimento, sexo: b.sexo, fumante: b.fumante, profissao: b.profissao, uf: b.uf,
    coberturas: b.coberturas.map(c => ({ id: c.id, capital: c.capital })) };
}

function proposta(b) {
  if (!b || typeof b !== 'object') falha('Corpo da requisição inválido');
  if (typeof b.idCotacao !== 'string') falha('idCotacao obrigatório');
  const p = b.proponente || {};
  if (!p.nome || String(p.nome).trim().split(/\s+/).length < 2) falha('Informe nome e sobrenome');
  if (!cpfValido(p.cpf)) falha('CPF inválido');
  if (!/^\S+@\S+\.\S+$/.test(p.email || '')) falha('E-mail inválido');
  if (!Array.isArray(b.declaracaoSaude) || !b.declaracaoSaude.every(x => typeof x === 'boolean')) falha('declaracaoSaude deve ser uma lista de true/false');
  if (!['mensal', 'anual'].includes(b.periodicidade)) falha('periodicidade deve ser mensal ou anual');
  const ac = b.aceites || {};
  if (!(ac.condicoesGerais === true && ac.declaracaoSaude === true && ac.lgpd === true)) falha('Os três aceites são obrigatórios');
  return {
    idCotacao: b.idCotacao,
    proponente: { nome: String(p.nome).trim(), cpf: String(p.cpf).replace(/\D/g, ''), email: String(p.email).trim().toLowerCase(),
      telefone: p.telefone ? String(p.telefone) : null },
    beneficiarios: String(b.beneficiarios || 'Herdeiros legais').slice(0, 500),
    declaracaoSaude: b.declaracaoSaude,
    periodicidade: b.periodicidade,
    aceites: { condicoesGerais: true, declaracaoSaude: true, lgpd: true },
  };
}

function pagamento(b) {
  if (!b || typeof b !== 'object') falha('Corpo da requisição inválido');
  if (typeof b.numeroProposta !== 'string') falha('numeroProposta obrigatório');
  if (typeof b.tokenCartao !== 'string' || !b.tokenCartao) falha('tokenCartao obrigatório (nunca envie o número do cartão)');
  if (/^\d{12,19}$/.test(b.tokenCartao.replace(/\s/g, ''))) falha('Envie o token do cartão, não o número do cartão');
  const parcelas = b.parcelas === undefined ? 1 : b.parcelas;
  if (![1, 2, 3, 4, 6, 10, 12].includes(parcelas)) falha('parcelas inválidas');
  return { numeroProposta: b.numeroProposta, tokenCartao: b.tokenCartao, parcelas };
}

module.exports = { cotacao, proposta, pagamento, cpfValido, ErroValidacao };
