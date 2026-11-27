'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const config = { ...require('../src/config'), comissaoPercentual: 30, adminToken: 'adm', webhookSecret: 'wh', insurer: 'mock', payments: 'mock' };
const db = require('../src/db').open(':memory:');
const app = require('../src/app')({ config, db, insurer: require('../src/insurer')(config), payments: require('../src/payments')(config) });

const call = (method, path, body, headers = {}, query = {}) => app.handle({ method, path, body, headers, query, ip: '127.0.0.1' });
const ADM = { 'x-admin-token': 'adm' }, WH = { 'x-webhook-secret': 'wh' };

const cotacao = {
  nascimento: '1988-05-14', sexo: 'F', fumante: false, profissao: 'admin', uf: 'PR',
  coberturas: [{ id: 'morte', capital: 200000 }, { id: 'ipa', capital: 200000 }, { id: 'fun', capital: 7000 }],
};
const proposta = (idCotacao, extra = {}) => ({
  idCotacao, proponente: { nome: 'Mariana Souza', cpf: '529.982.247-25', email: 'mariana@exemplo.com' },
  beneficiarios: 'Herdeiros legais', declaracaoSaude: [false, false, false, false], periodicidade: 'mensal',
  aceites: { condicoesGerais: true, declaracaoSaude: true, lgpd: true }, ...extra,
});

test('mensal: cotação, proposta, pagamento e comissão de 30% sobre o prêmio líquido', async () => {
  const [s1, cot] = await call('POST', '/api/cotacoes', cotacao);
  assert.equal(s1, 201);
  assert.equal(cot.comissaoMaxima, undefined, 'comissão não vai para o cliente');

  const [s2, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao));
  assert.equal(s2, 201); assert.equal(prop.status, 'ACEITA');

  const [s3, pag] = await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_aprova_4111' });
  assert.equal(s3, 201); assert.equal(pag.status, 'APROVADO');

  const [, lista] = await call('GET', '/api/admin/comissoes', null, ADM);
  const c = lista.find(x => x.proposta_numero === prop.numeroProposta);
  assert.equal(c.percentual, 30);
  assert.equal(c.base_calculo, cot.premioLiquido);
  assert.equal(c.valor, Math.round(cot.premioLiquido * 0.3 * 100) / 100);
  assert.equal(c.status, 'A_RECEBER');

  // segunda mensalidade via webhook do gateway gera outra comissão
  const [s4] = await call('POST', '/api/webhooks/pagamentos', { numeroProposta: prop.numeroProposta, status: 'APROVADO', autorizacao: 'REC002' }, WH);
  assert.equal(s4, 200);
  const [, lista2] = await call('GET', '/api/admin/comissoes', null, ADM);
  assert.equal(lista2.filter(x => x.proposta_numero === prop.numeroProposta).length, 2);

  // admin marca como recebida
  const [s5] = await call('POST', `/api/admin/comissoes/${c.id}/recebida`, null, ADM);
  assert.equal(s5, 200);
});

test('anual: comissão de 30% sobre o prêmio anual sem IOF', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao, { periodicidade: 'anual' }));
  const [s, pag] = await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_aprova_4111', parcelas: 12 });
  assert.equal(s, 201); assert.equal(pag.parcelas, 12); assert.equal(pag.valor, cot.premioAnual);
  const [, lista] = await call('GET', '/api/admin/comissoes', null, ADM);
  const c = lista.find(x => x.proposta_numero === prop.numeroProposta);
  const base = Math.round(cot.premioAnual / 1.0038 * 100) / 100;
  assert.equal(c.base_calculo, base);
  assert.equal(c.valor, Math.round(base * 0.3 * 100) / 100);

  const [s2] = await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_aprova_4111' });
  assert.equal(s2, 409, 'não cobra duas vezes');
});

test('declaração de saúde com "sim": comissão prevista; recusa cancela e estorna', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao, { declaracaoSaude: [true, false, false, false] }));
  assert.equal(prop.status, 'EM_ANALISE_SUBSCRICAO');
  await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_aprova_4111' });
  let [, lista] = await call('GET', '/api/admin/comissoes', null, ADM);
  assert.equal(lista.find(x => x.proposta_numero === prop.numeroProposta).status, 'PREVISTA');

  const [s, r] = await call('POST', '/api/webhooks/seguradora', { numeroProposta: prop.numeroProposta, status: 'RECUSADA' }, WH);
  assert.equal(s, 200); assert.equal(r.estornos, 1);
  [, lista] = await call('GET', '/api/admin/comissoes', null, ADM);
  assert.equal(lista.find(x => x.proposta_numero === prop.numeroProposta).status, 'CANCELADA');
});

test('cartão recusado não gera comissão', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao));
  const [s] = await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_recusa_0002' });
  assert.equal(s, 402);
  const [, lista] = await call('GET', '/api/admin/comissoes', null, ADM);
  assert.equal(lista.filter(x => x.proposta_numero === prop.numeroProposta).length, 0);
});

test('validações e segurança', async () => {
  assert.equal((await call('POST', '/api/cotacoes', { ...cotacao, nascimento: '1950-01-01' }))[0], 422);
  assert.equal((await call('POST', '/api/cotacoes', { ...cotacao, coberturas: [{ id: 'ipa', capital: 50000 }] }))[0], 422);
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  assert.equal((await call('POST', '/api/propostas', proposta(cot.idCotacao, { proponente: { nome: 'A B', cpf: '111.111.111-11', email: 'a@b.co' } })))[0], 422);
  assert.equal((await call('POST', '/api/pagamentos', { numeroProposta: 'X', tokenCartao: '4111111111111111' }))[0], 422);
  assert.equal((await call('GET', '/api/admin/comissoes', null, { 'x-admin-token': 'errado' }))[0], 401);
  assert.equal((await call('POST', '/api/webhooks/seguradora', { numeroProposta: 'X', status: 'ACEITA' }, {}))[0], 401);
});

test('rota pública /api/saude não expõe a comissão', async () => {
  const [s, r] = await call('GET', '/api/saude');
  assert.equal(s, 200); assert.equal(r.ok, true);
  assert.ok(!/comiss/i.test(JSON.stringify(r)), 'nenhum campo de comissão na rota pública');
});

test('resumo do programa de comissão', async () => {
  const [s, r] = await call('GET', '/api/admin/comissoes/resumo', null, ADM);
  assert.equal(s, 200); assert.equal(r.percentualVigente, 30);
  assert.ok(r.porStatus.length > 0);
});

test('vigência de 5 anos com renovação automática', async () => {
  const { somarAnos } = require('../src/app');
  assert.equal(somarAnos('2026-11-24', 5), '2031-11-24');
  assert.equal(somarAnos('2028-02-29', 5), '2033-02-28');

  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao));
  assert.equal(prop.vigencia.anos, 5);
  assert.equal(prop.vigencia.renovacaoAutomatica, true);
  assert.equal(prop.vigencia.fim, somarAnos(prop.vigencia.inicio, 5));

  const [, cons] = await call('GET', `/api/propostas/${prop.numeroProposta}`);
  assert.equal(cons.vigencia.fim, prop.vigencia.fim);

  // Ainda longe do fim: nada a renovar
  let [, r] = await call('POST', '/api/admin/renovacoes/processar', {}, ADM);
  assert.equal(r.resultado.find(x => x.numeroProposta === prop.numeroProposta), undefined);

  // 20 dias antes do fim (dentro dos 30 dias de antecedência): renova por mais 5 anos
  const ref = new Date(prop.vigencia.fim + 'T00:00:00Z'); ref.setUTCDate(ref.getUTCDate() - 20);
  [, r] = await call('POST', '/api/admin/renovacoes/processar', { dataReferencia: ref.toISOString().slice(0, 10) }, ADM);
  const item = r.resultado.find(x => x.numeroProposta === prop.numeroProposta);
  assert.equal(item.status, 'RENOVADA');
  assert.equal(item.novaVigencia.inicio, prop.vigencia.fim);
  assert.equal(item.novaVigencia.fim, somarAnos(prop.vigencia.fim, 5));
  const [, depois] = await call('GET', `/api/propostas/${prop.numeroProposta}`);
  assert.equal(depois.vigencia.renovacoes, 1);

  // Cliente pede para não renovar: fica fora do próximo ciclo
  await call('POST', `/api/admin/propostas/${prop.numeroProposta}/renovacao`, { ativa: false }, ADM);
  const ref2 = new Date(depois.vigencia.fim + 'T00:00:00Z'); ref2.setUTCDate(ref2.getUTCDate() - 5);
  [, r] = await call('POST', '/api/admin/renovacoes/processar', { dataReferencia: ref2.toISOString().slice(0, 10) }, ADM);
  assert.equal(r.resultado.find(x => x.numeroProposta === prop.numeroProposta), undefined);
});

test('plano anual: cobrança de cada ano gera nova comissão de 30%', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao, { periodicidade: 'anual' }));
  await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_aprova_4111', parcelas: 12 });
  const [s] = await call('POST', '/api/webhooks/pagamentos', { numeroProposta: prop.numeroProposta, status: 'APROVADO', autorizacao: 'ANO2', parcelas: 12 }, WH);
  assert.equal(s, 200);
  const [, lista] = await call('GET', '/api/admin/comissoes', null, ADM);
  const cs = lista.filter(x => x.proposta_numero === prop.numeroProposta);
  assert.equal(cs.length, 2);
  assert.ok(cs.every(c => c.percentual === 30));
});

test('banco antigo recebe as colunas novas (migração)', () => {
  const { DatabaseSync } = require('node:sqlite');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const f = path.join(os.tmpdir(), `mig-${Date.now()}.db`);
  const velho = new DatabaseSync(f);
  velho.exec(`CREATE TABLE propostas (numero TEXT PRIMARY KEY, status TEXT)`); velho.close();
  const novo = require('../src/db').open(f);
  const cols = novo.prepare('PRAGMA table_info(propostas)').all().map(c => c.name);
  assert.ok(['vigencia_inicio', 'vigencia_fim', 'renovacao_automatica', 'renovacoes'].every(c => cols.includes(c)));
  novo.close(); fs.rmSync(f, { force: true }); fs.rmSync(f + '-wal', { force: true }); fs.rmSync(f + '-shm', { force: true });
});
