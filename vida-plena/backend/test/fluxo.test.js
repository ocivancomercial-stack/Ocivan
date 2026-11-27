'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { abrirBanco } = require('../src/db');
const { criarCripto, contextoDeclaracao } = require('../src/services/cripto');

// Por padrão, testa no SQLite em memória. Com TEST_DATABASE_URL, testa no PostgreSQL,
// num schema temporário que é apagado no fim (os dados existentes não são tocados).
const PG = process.env.TEST_DATABASE_URL || '';
const SCHEMA = PG ? `teste_${process.pid}_${Date.now()}` : '';
const CHAVE = Buffer.alloc(32, 7).toString('base64');
const config = { ...require('../src/config'), comissaoPercentual: 30, adminToken: 'adm', webhookSecret: 'wh', insurer: 'mock', payments: 'mock',
  chaveDadosSensiveis: CHAVE };
let db, app;
test.before(async () => {
  db = await abrirBanco({ databaseUrl: PG, dbSchema: SCHEMA, dbPath: ':memory:' });
  app = require('../src/app')({ config, db, insurer: require('../src/insurer')(config), payments: require('../src/payments')(config, {}) });
});
test.after(async () => {
  if (PG) await db.run(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await db.fechar();
});

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

  // segunda mensalidade via webhook de pagamentos gera outra comissão
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

test('PAYMENTS=tokio cobra pela Tokio e exige INSURER=tokio', async () => {
  const criar = require('../src/payments');
  assert.throws(() => criar({ payments: 'tokio' }, { insurer: require('../src/insurer')(config) }), /INSURER=tokio/);
  assert.throws(() => criar({ payments: 'gateway' }, {}), /PAYMENTS inválido/);
  const chamadas = [];
  const tokioFalso = { cobrar: async d => { chamadas.push(['cobrar', d]); return { status: 'APROVADO', autorizacao: 'TK1' }; },
    estornar: async d => { chamadas.push(['estornar', d]); return { status: 'ESTORNADO' }; } };
  const pag = criar({ payments: 'tokio' }, { insurer: tokioFalso });
  assert.equal(pag.nome, 'tokio');
  assert.equal((await pag.cobrar({ token: 'tok_x', valor: 10, parcelas: 1, recorrente: true, referencia: 'PRP-1' })).autorizacao, 'TK1');
  await pag.estornar({ autorizacao: 'TK1', valor: 10 });
  assert.deepEqual(chamadas.map(c => c[0]), ['cobrar', 'estornar']);
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

test('declaração de saúde gravada criptografada (LGPD)', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao, { declaracaoSaude: [false, true, false, false] }));
  const { declaracao_saude_json: gravado } = await db.get('SELECT declaracao_saude_json FROM propostas WHERE numero=?', prop.numeroProposta);
  assert.match(gravado, /^enc:v1:/);
  assert.ok(!gravado.includes('true'), 'nada da declaração aparece em texto puro');
  const cripto = criarCripto(CHAVE);
  assert.deepEqual(JSON.parse(cripto.decifrar(gravado, contextoDeclaracao(prop.numeroProposta))), [false, true, false, false]);
  // Copiar o valor cifrado para outra proposta não funciona, nem alterar o texto cifrado
  assert.throws(() => cripto.decifrar(gravado, contextoDeclaracao('PRP-OUTRA')));
  const adulterado = gravado.slice(0, -4) + (gravado.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.throws(() => cripto.decifrar(adulterado, contextoDeclaracao(prop.numeroProposta)));
  assert.throws(() => criarCripto(CHAVE).decifrar(gravado, 'x'));
  assert.throws(() => criarCripto('curta'), /32 bytes/);
});

test('filtros de data das comissões e resumo por mês', async () => {
  const hojeStr = new Date().toISOString().slice(0, 10);
  const [s1, doDia] = await call('GET', '/api/admin/comissoes', null, ADM, { de: hojeStr, ate: hojeStr });
  assert.equal(s1, 200); assert.ok(doDia.length > 0);
  const [, futuro] = await call('GET', '/api/admin/comissoes', null, ADM, { de: '2999-01-01' });
  assert.equal(futuro.length, 0);
  assert.equal((await call('GET', '/api/admin/comissoes', null, ADM, { de: '2026-02-31' }))[0], 422);
  const [, r] = await call('GET', '/api/admin/comissoes/resumo', null, ADM);
  assert.equal(r.porMes[0].mes, hojeStr.slice(0, 7));
  assert.equal(typeof r.porMes[0].total, 'number');
  assert.ok(r.porStatus.every(x => typeof x.quantidade === 'number' && typeof x.total === 'number'));
});

test('produção exige PostgreSQL e chave de criptografia', () => {
  const { spawnSync } = require('node:child_process');
  const rodar = env => spawnSync(process.execPath, ['-e', "require('./src/config')"], { cwd: __dirname + '/..', env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  assert.match(rodar({ DATABASE_URL: 'postgres://x' }).stderr, /CHAVE_DADOS_SENSIVEIS/);
  assert.match(rodar({ NODE_ENV: 'production', CHAVE_DADOS_SENSIVEIS: CHAVE }).stderr, /DATABASE_URL/);
  assert.match(rodar({ CHAVE_DADOS_SENSIVEIS: 'curta' }).stderr, /32 bytes/);
  assert.equal(rodar({ DATABASE_URL: 'postgres://x', CHAVE_DADOS_SENSIVEIS: CHAVE }).status, 0);
});

test('painel: lista de propostas sem declaração de saúde e com CPF mascarado', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao, {
    proponente: { nome: 'Joana Painel Teste', cpf: '111.444.777-35', email: 'joana@exemplo.com' }, periodicidade: 'anual' }));
  await call('POST', '/api/pagamentos', { numeroProposta: prop.numeroProposta, tokenCartao: 'tok_aprova_4111', parcelas: 12 });

  assert.equal((await call('GET', '/api/admin/propostas', null, {}))[0], 401);
  const [s, lista] = await call('GET', '/api/admin/propostas', null, ADM, { busca: 'joana painel' });
  assert.equal(s, 200);
  assert.equal(lista.length, 1);
  const p = lista[0];
  assert.equal(p.numero, prop.numeroProposta);
  assert.equal(p.cpf, '***.444.777-**');
  assert.equal(p.valor, cot.premioAnual);
  assert.equal(p.renovacao_automatica, true);
  assert.equal(p.comissao_total, Math.round(Math.round(cot.premioAnual / 1.0038 * 100) / 100 * 0.3 * 100) / 100);
  assert.ok(!JSON.stringify(lista).includes('declaracao'), 'a declaração de saúde nunca sai na lista');
  assert.ok(!JSON.stringify(lista).includes('11144477735'), 'o CPF completo não sai na lista');

  assert.equal((await call('GET', '/api/admin/propostas', null, ADM, { busca: '444.777' }))[1].length, 1, 'busca por parte do CPF');
  assert.equal((await call('GET', '/api/admin/propostas', null, ADM, { busca: prop.numeroProposta.toLowerCase() }))[1].length, 1);
  assert.equal((await call('GET', '/api/admin/propostas', null, ADM, { busca: '%' }))[1].length > 1, true, '% não vira curinga, a busca fica vazia');
  assert.ok((await call('GET', '/api/admin/propostas', null, ADM, { status: 'ACEITA' }))[1].every(x => x.status === 'ACEITA'));
  assert.equal((await call('GET', '/api/admin/propostas', null, ADM, { status: 'X' }))[0], 422);
});

test('datas no fuso de Brasília', () => {
  const { partesNoFuso } = require('../src/services/datas');
  assert.deepEqual(partesNoFuso('America/Sao_Paulo', new Date('2026-11-28T01:30:00Z')), { data: '2026-11-27', hora: 22, minuto: 30 });
  assert.equal(partesNoFuso('America/Sao_Paulo', new Date('2026-11-28T06:00:00Z')).hora, 3);
});

test('agendador: roda uma vez por dia, a partir da hora certa, mesmo com dois servidores', async () => {
  const { criarAgendador } = require('../src/agendador');
  let t = new Date('2026-11-27T05:30:00Z'); // 02:30 em Brasília
  let execucoes = 0;
  const novo = () => criarAgendador({ db, tarefa: 'teste_diario', hora: 3, fusoHorario: 'America/Sao_Paulo', agora: () => t, log: {},
    executar: async data => { execucoes++; return { data }; } });
  const s1 = novo(), s2 = novo();

  assert.equal((await s1.conferir()).motivo, 'antes do horário');
  t = new Date('2026-11-27T06:10:00Z'); // 03:10
  const r = await s1.conferir();
  assert.equal(r.executou, true); assert.equal(r.data, '2026-11-27');
  assert.equal((await s2.conferir()).executou, false, 'o outro servidor não roda o mesmo dia');
  assert.equal((await s1.conferir()).executou, false, 'nem o mesmo servidor de novo');

  // Dia seguinte, os dois conferem ao mesmo tempo: só um executa
  t = new Date('2026-11-28T13:00:00Z');
  const ambos = await Promise.all([s1.conferir(), s2.conferir()]);
  assert.equal(ambos.filter(x => x.executou).length, 1);
  assert.equal(execucoes, 2);
  const linhas = await db.all(`SELECT status FROM agendamentos WHERE tarefa='teste_diario'`);
  assert.deepEqual(linhas.map(l => l.status), ['CONCLUIDA', 'CONCLUIDA']);
});

test('agendador: tenta de novo depois de erro e assume execução travada', async () => {
  const { criarAgendador } = require('../src/agendador');
  let t = new Date('2026-11-29T10:00:00Z'), falhar = true;
  const ag = criarAgendador({ db, tarefa: 'teste_erro', hora: 3, fusoHorario: 'America/Sao_Paulo', agora: () => t, log: {},
    executar: async () => { if (falhar) throw new Error('seguradora fora do ar'); return { ok: true }; } });
  assert.equal((await ag.conferir()).erro, 'seguradora fora do ar');
  t = new Date(t.getTime() + 5 * 60_000);
  assert.equal((await ag.conferir()).executou, false, 'espera antes de tentar de novo');
  falhar = false; t = new Date(t.getTime() + 15 * 60_000);
  assert.equal((await ag.conferir()).executou, true);
  assert.equal((await db.get(`SELECT status FROM agendamentos WHERE tarefa='teste_erro'`)).status, 'CONCLUIDA');

  // Servidor caiu no meio de uma execução (ficou EXECUTANDO há 2 horas): outro servidor assume
  await db.run(`INSERT INTO agendamentos (tarefa, data_referencia, status, iniciado_em) VALUES ('teste_travada', '2026-11-29', 'EXECUTANDO', ?)`,
    new Date(t.getTime() - 2 * 3600_000).toISOString());
  const ag2 = criarAgendador({ db, tarefa: 'teste_travada', hora: 3, fusoHorario: 'America/Sao_Paulo', agora: () => t, log: {}, executar: async () => ({}) });
  assert.equal((await ag2.conferir()).executou, true);
});

test('agendador renova a apólice e o histórico aparece no admin', async () => {
  const { criarAgendador } = require('../src/agendador');
  const { somarAnos } = require('../src/app');
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao));
  // Relógio 20 dias antes do fim da vigência, ao meio-dia em Brasília
  const t = new Date(prop.vigencia.fim + 'T15:00:00Z'); t.setUTCDate(t.getUTCDate() - 20);
  const ag = criarAgendador({ db, tarefa: 'renovacoes', hora: 3, fusoHorario: 'America/Sao_Paulo', agora: () => t, log: {},
    executar: data => app.renovarVencendo(data) });
  const r = await ag.conferir();
  const item = r.resultado.resultado.find(x => x.numeroProposta === prop.numeroProposta);
  assert.equal(item.status, 'RENOVADA');
  assert.equal(item.novaVigencia.fim, somarAnos(prop.vigencia.fim, 5));
  const [s, hist] = await call('GET', '/api/admin/agendamentos', null, ADM);
  assert.equal(s, 200);
  const ex = hist.find(h => h.tarefa === 'renovacoes' && h.data_referencia === t.toISOString().slice(0, 10));
  assert.equal(ex.status, 'CONCLUIDA');
  assert.ok(ex.resultado.resultado.some(x => x.numeroProposta === prop.numeroProposta));
  assert.equal((await call('GET', '/api/admin/agendamentos', null, {}))[0], 401);
});

test('duas renovações ao mesmo tempo não estendem a vigência duas vezes', async () => {
  const [, cot] = await call('POST', '/api/cotacoes', cotacao);
  const [, prop] = await call('POST', '/api/propostas', proposta(cot.idCotacao));
  const ref = new Date(prop.vigencia.fim + 'T00:00:00Z'); ref.setUTCDate(ref.getUTCDate() - 10);
  const dia = ref.toISOString().slice(0, 10);
  const [a, b] = await Promise.all([app.renovarVencendo(dia), app.renovarVencendo(dia)]);
  const status = [a, b].map(r => r.resultado.find(x => x.numeroProposta === prop.numeroProposta).status).sort();
  assert.deepEqual(status, ['JA_PROCESSADA', 'RENOVADA']);
  const [, cons] = await call('GET', `/api/propostas/${prop.numeroProposta}`);
  assert.equal(cons.vigencia.renovacoes, 1);
  const { n } = await db.get('SELECT COUNT(*) AS n FROM renovacoes WHERE proposta_numero=?', prop.numeroProposta);
  assert.equal(n, 1);
});

test('banco SQLite antigo recebe as colunas novas (migração)', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const f = path.join(os.tmpdir(), `mig-${Date.now()}.db`);
  const velho = new DatabaseSync(f);
  velho.exec(`CREATE TABLE propostas (numero TEXT PRIMARY KEY, status TEXT)`); velho.close();
  const novo = require('../src/db/sqlite').abrir(f);
  const cols = (await novo.all('PRAGMA table_info(propostas)')).map(c => c.name);
  assert.ok(['vigencia_inicio', 'vigencia_fim', 'renovacao_automatica', 'renovacoes'].every(c => cols.includes(c)));
  await novo.fechar(); fs.rmSync(f, { force: true }); fs.rmSync(f + '-wal', { force: true }); fs.rmSync(f + '-shm', { force: true });
});
