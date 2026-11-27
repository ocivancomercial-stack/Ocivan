'use strict';

const crypto = require('node:crypto');
const V = require('./services/validacao');
const C = require('./services/comissao');
const { criarCripto, contextoDeclaracao } = require('./services/cripto');

class ErroHttp extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// Soma anos a uma data AAAA-MM-DD (29/02 vira 28/02 em ano não bissexto).
function somarAnos(data, anos) {
  const [a, m, d] = data.split('-').map(Number);
  const ult = new Date(Date.UTC(a + anos, m, 0)).getUTCDate();
  return `${a + anos}-${String(m).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
}
const hoje = () => new Date().toISOString().slice(0, 10);
function somarDias(data, dias) { const t = new Date(data + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + dias); return t.toISOString().slice(0, 10); }

function tokenOk(recebido, esperado) {
  if (!esperado || typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// db: interface de ./db (SQLite ou PostgreSQL), toda assíncrona.
module.exports = function createApp({ config, db, insurer, payments }) {
  // Declaração de saúde (LGPD): gravada cifrada quando há chave. A config exige a chave em produção.
  const cripto = config.chaveDadosSensiveis ? criarCripto(config.chaveDadosSensiveis) : null;
  if (!cripto) console.warn('Aviso: CHAVE_DADOS_SENSIVEIS ausente; a declaração de saúde será gravada SEM criptografia (só aceitável em desenvolvimento).');
  const gravarDeclaracao = (numero, declaracao) => {
    const json = JSON.stringify(declaracao);
    return cripto ? cripto.cifrar(json, contextoDeclaracao(numero)) : json;
  };

  // ---------- Cliente ----------
  async function criarCotacao({ body }) {
    const entrada = V.cotacao(body);
    const c = await insurer.cotar(entrada);
    await db.run(`INSERT INTO cotacoes (id, entrada_json, resposta_json, premio_liquido, iof, premio_mensal, premio_anual, valida_ate)
       VALUES (?,?,?,?,?,?,?,?)`, c.idCotacao, JSON.stringify(entrada), JSON.stringify(c),
      c.premioLiquido, c.iof, c.premioMensal, c.premioAnual, c.validaAte);
    // A comissão não é exposta ao cliente na cotação.
    const { comissaoMaxima, ...publico } = c;
    return [201, publico];
  }

  async function criarProposta({ body, ip }) {
    const p = V.proposta(body);
    const cot = await db.get('SELECT * FROM cotacoes WHERE id=?', p.idCotacao);
    if (!cot) throw new ErroHttp(404, 'Cotação não encontrada');
    if (cot.valida_ate < new Date().toISOString().slice(0, 10)) throw new ErroHttp(410, 'Cotação vencida. Faça uma nova cotação.');
    const entrada = JSON.parse(cot.entrada_json);
    const resp = JSON.parse(cot.resposta_json);

    const pct = config.comissaoPercentual;
    if (resp.comissaoMaxima != null && pct > resp.comissaoMaxima) {
      throw new ErroHttp(409, `Comissão configurada (${pct}%) acima do máximo do produto (${resp.comissaoMaxima}%)`);
    }

    const vigencia = { inicio: hoje(), fim: somarAnos(hoje(), config.vigenciaAnos), anos: config.vigenciaAnos, renovacaoAutomatica: config.renovacaoAutomatica };
    const r = await insurer.emitirProposta({ ...p, proponente: { ...p.proponente, nascimento: entrada.nascimento }, comissaoPercentual: pct, vigencia });

    await db.tx(async b => {
      const cli = await b.get(`INSERT INTO clientes (cpf, nome, email, telefone, nascimento) VALUES (?,?,?,?,?)
         ON CONFLICT(cpf) DO UPDATE SET nome=excluded.nome, email=excluded.email, telefone=COALESCE(excluded.telefone, clientes.telefone)
         RETURNING id`, p.proponente.cpf, p.proponente.nome, p.proponente.email, p.proponente.telefone, entrada.nascimento);
      await b.run(`INSERT INTO propostas (numero, cotacao_id, cliente_id, beneficiarios, declaracao_saude_json, periodicidade, status,
          comissao_percentual, aceites_json, aceites_ip, vigencia_inicio, vigencia_fim, renovacao_automatica) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          r.numeroProposta, cot.id, cli.id, p.beneficiarios, gravarDeclaracao(r.numeroProposta, p.declaracaoSaude), p.periodicidade,
          r.status, pct, JSON.stringify({ ...p.aceites, em: new Date().toISOString() }), ip || null,
          vigencia.inicio, vigencia.fim, vigencia.renovacaoAutomatica ? 1 : 0);
    });

    const valor = p.periodicidade === 'anual' ? cot.premio_anual : cot.premio_mensal;
    return [201, { numeroProposta: r.numeroProposta, status: r.status, periodicidade: p.periodicidade, valor, vigencia }];
  }

  function registrarPagamento({ numero, valor, liquido, parcelas, recorrente, r }) {
    return db.tx(async b => {
      const pag = await b.get(`INSERT INTO pagamentos (proposta_numero, valor, premio_liquido, parcelas, recorrente, status, autorizacao,
          cartao_final, cartao_bandeira, motivo) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`,
          numero, valor, liquido, parcelas, recorrente ? 1 : 0, r.status, r.autorizacao || null,
          r.cartaoFinal || null, r.bandeira || null, r.motivo || null);
      let comissao = null;
      if (r.status === 'APROVADO') {
        const prop = await b.get('SELECT status, comissao_percentual FROM propostas WHERE numero=?', numero);
        const c = C.calcular(liquido, prop.comissao_percentual);
        await b.run(`INSERT INTO comissoes (proposta_numero, pagamento_id, base_calculo, percentual, valor, status) VALUES (?,?,?,?,?,?)`,
          numero, pag.id, c.base_calculo, c.percentual, c.valor, C.statusInicial(prop.status));
        comissao = c;
      }
      return { pagamentoId: pag.id, comissao };
    });
  }

  async function pagar({ body }) {
    const b = V.pagamento(body);
    const prop = await db.get(`SELECT p.*, c.premio_mensal, c.premio_anual, c.premio_liquido, c.iof
                    FROM propostas p JOIN cotacoes c ON c.id=p.cotacao_id WHERE p.numero=?`, b.numeroProposta);
    if (!prop) throw new ErroHttp(404, 'Proposta não encontrada');
    if (['RECUSADA', 'CANCELADA'].includes(prop.status)) throw new ErroHttp(409, 'Proposta recusada ou cancelada');
    if (await db.get(`SELECT 1 AS x FROM pagamentos WHERE proposta_numero=? AND status='APROVADO'`, prop.numero)) {
      throw new ErroHttp(409, 'Esta proposta já foi paga');
    }

    const anual = prop.periodicidade === 'anual';
    const valor = anual ? prop.premio_anual : prop.premio_mensal;
    const liquido = anual ? C.r2(prop.premio_anual / (1 + config.iof)) : prop.premio_liquido;
    const parcelas = anual ? b.parcelas : 1;

    const r = await payments.cobrar({ token: b.tokenCartao, valor, parcelas, recorrente: !anual,
      descricao: `Seguro de vida - proposta ${prop.numero}`, referencia: prop.numero });
    await registrarPagamento({ numero: prop.numero, valor, liquido, parcelas, recorrente: !anual, r });

    if (r.status !== 'APROVADO') return [402, { status: 'RECUSADO', motivo: r.motivo }];
    return [201, { status: 'APROVADO', autorizacao: r.autorizacao, valor, parcelas, statusProposta: prop.status }];
  }

  async function consultarProposta({ params }) {
    const p = await db.get('SELECT * FROM propostas WHERE numero=?', params.numero);
    if (!p) throw new ErroHttp(404, 'Proposta não encontrada');
    return [200, { numeroProposta: p.numero, status: p.status, numeroApolice: p.numero_apolice, periodicidade: p.periodicidade, criadaEm: p.criado_em,
      vigencia: { inicio: p.vigencia_inicio, fim: p.vigencia_fim, renovacaoAutomatica: !!p.renovacao_automatica, renovacoes: p.renovacoes } }];
  }

  // ---------- Webhooks ----------
  function exigirWebhook(headers) {
    if (!tokenOk(headers['x-webhook-secret'], config.webhookSecret)) throw new ErroHttp(401, 'Webhook não autorizado');
  }

  // Seguradora avisa mudança de status (aceite, recusa, emissão da apólice).
  async function webhookSeguradora({ body, headers }) {
    exigirWebhook(headers);
    const STATUS = ['ACEITA', 'EM_ANALISE_SUBSCRICAO', 'RECUSADA', 'APOLICE_EMITIDA', 'CANCELADA'];
    if (!body || !STATUS.includes(body.status)) throw new ErroHttp(422, 'status inválido');
    const prop = await db.get('SELECT * FROM propostas WHERE numero=?', body.numeroProposta);
    if (!prop) throw new ErroHttp(404, 'Proposta não encontrada');

    const estornar = ['RECUSADA', 'CANCELADA'].includes(body.status)
      ? await db.all(`SELECT * FROM pagamentos WHERE proposta_numero=? AND status='APROVADO'`, prop.numero) : [];
    for (const pg of estornar) await payments.estornar({ autorizacao: pg.autorizacao, valor: pg.valor });

    await db.tx(async b => {
      await b.run(`UPDATE propostas SET status=?, numero_apolice=COALESCE(?, numero_apolice), atualizado_em=CURRENT_TIMESTAMP WHERE numero=?`,
        body.status, body.numeroApolice || null, prop.numero);
      for (const pg of estornar) await b.run(`UPDATE pagamentos SET status='ESTORNADO' WHERE id=?`, pg.id);
      await C.aoMudarStatusProposta(b, prop.numero, body.status);
    });
    return [200, { ok: true, estornos: estornar.length }];
  }

  // Gateway avisa cobrança recorrente: cada mensalidade (plano mensal) ou cada ano (plano anual)
  // durante os 5 anos de vigência e nas renovações. Cada pagamento aprovado gera comissão de 30%.
  async function webhookPagamento({ body, headers }) {
    exigirWebhook(headers);
    const prop = body && await db.get(`SELECT p.*, c.premio_liquido, c.premio_mensal, c.premio_anual FROM propostas p JOIN cotacoes c ON c.id=p.cotacao_id WHERE p.numero=?`, body.numeroProposta);
    if (!prop) throw new ErroHttp(404, 'Proposta não encontrada');
    if (['RECUSADA', 'CANCELADA'].includes(prop.status)) throw new ErroHttp(409, 'Proposta recusada ou cancelada');
    if (!['APROVADO', 'RECUSADO'].includes(body.status)) throw new ErroHttp(422, 'status inválido');
    if (body.autorizacao && await db.get('SELECT 1 AS x FROM pagamentos WHERE autorizacao=?', body.autorizacao)) return [200, { ok: true, duplicado: true }];
    const anual = prop.periodicidade === 'anual';
    const r = await registrarPagamento({ numero: prop.numero, valor: anual ? prop.premio_anual : prop.premio_mensal,
      liquido: anual ? C.r2(prop.premio_anual / (1 + config.iof)) : prop.premio_liquido, parcelas: Number(body.parcelas) || 1, recorrente: true,
      r: { status: body.status, autorizacao: body.autorizacao, motivo: body.motivo } });
    return [200, { ok: true, ...r }];
  }

  // ---------- Admin: programa de comissão ----------
  function exigirAdmin(headers) {
    if (!tokenOk(headers['x-admin-token'], config.adminToken)) throw new ErroHttp(401, 'Não autorizado');
  }

  async function listarComissoes({ headers, query }) {
    exigirAdmin(headers);
    const cond = [], args = [];
    if (query.status) { cond.push('c.status=?'); args.push(query.status); }
    // Datas no formato AAAA-MM-DD; "ate" inclui o dia inteiro.
    if (query.de) { cond.push('c.criado_em>=?'); args.push(V.data(query.de, 'de')); }
    if (query.ate) { cond.push('c.criado_em<?'); args.push(somarDias(V.data(query.ate, 'ate'), 1)); }
    const rows = await db.all(`SELECT c.id, c.proposta_numero, cl.nome AS cliente, p.periodicidade, p.status AS status_proposta,
        c.base_calculo, c.percentual, c.valor, c.status, c.criado_em, c.recebida_em
      FROM comissoes c JOIN propostas p ON p.numero=c.proposta_numero JOIN clientes cl ON cl.id=p.cliente_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY c.criado_em DESC, c.id DESC LIMIT 500`, ...args);
    return [200, rows];
  }

  async function resumoComissoes({ headers }) {
    exigirAdmin(headers);
    const porStatus = await db.all(`SELECT status, COUNT(*) AS quantidade, ROUND(SUM(valor),2) AS total FROM comissoes GROUP BY status ORDER BY status`);
    const porMes = await db.all(`SELECT ${db.mes('criado_em')} AS mes, ROUND(SUM(CASE WHEN status<>'CANCELADA' THEN valor ELSE 0 END),2) AS total
      FROM comissoes GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    return [200, { percentualVigente: config.comissaoPercentual, porStatus, porMes }];
  }

  async function marcarRecebida({ headers, params }) {
    exigirAdmin(headers);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) throw new ErroHttp(404, 'Comissão não encontrada');
    const c = await db.get('SELECT status FROM comissoes WHERE id=?', id);
    if (!c) throw new ErroHttp(404, 'Comissão não encontrada');
    if (c.status !== 'A_RECEBER') throw new ErroHttp(409, `Só comissões A_RECEBER podem ser marcadas como recebidas (atual: ${c.status})`);
    await db.run(`UPDATE comissoes SET status='RECEBIDA', recebida_em=CURRENT_TIMESTAMP WHERE id=?`, id);
    return [200, { ok: true }];
  }

  // ---------- Admin: vigência e renovação automática ----------
  // Renova as apólices cuja vigência termina dentro da antecedência configurada (padrão 30 dias).
  // Rodar uma vez por dia (agendador do servidor / cron chamando esta rota).
  async function processarRenovacoes({ headers, body }) {
    exigirAdmin(headers);
    const ref = body && body.dataReferencia ? V.data(body.dataReferencia, 'dataReferencia') : hoje();
    const limite = somarDias(ref, config.renovacaoAntecedenciaDias);
    const lista = await db.all(`SELECT * FROM propostas WHERE renovacao_automatica=1 AND status IN ('ACEITA','APOLICE_EMITIDA')
                     AND vigencia_fim IS NOT NULL AND vigencia_fim<=? ORDER BY vigencia_fim`, limite);
    const resultado = [];
    for (const p of lista) {
      const novoInicio = p.vigencia_fim, novoFim = somarAnos(p.vigencia_fim, config.vigenciaAnos);
      let r;
      try { r = await insurer.renovar({ numeroProposta: p.numero, novaVigenciaInicio: novoInicio, novaVigenciaFim: novoFim }); }
      catch (e) { resultado.push({ numeroProposta: p.numero, status: 'ERRO', motivo: e.message }); continue; }
      await db.tx(async b => {
        await b.run(`INSERT INTO renovacoes (proposta_numero, vigencia_anterior_fim, nova_vigencia_inicio, nova_vigencia_fim, status, motivo) VALUES (?,?,?,?,?,?)`,
          p.numero, p.vigencia_fim, novoInicio, novoFim, r.status, r.motivo || null);
        if (r.status === 'RENOVADA') {
          await b.run(`UPDATE propostas SET vigencia_inicio=?, vigencia_fim=?, renovacoes=renovacoes+1, atualizado_em=CURRENT_TIMESTAMP WHERE numero=?`, novoInicio, novoFim, p.numero);
        } else {
          await b.run(`UPDATE propostas SET renovacao_automatica=0, atualizado_em=CURRENT_TIMESTAMP WHERE numero=?`, p.numero);
        }
      });
      resultado.push({ numeroProposta: p.numero, status: r.status, novaVigencia: r.status === 'RENOVADA' ? { inicio: novoInicio, fim: novoFim } : null, motivo: r.motivo });
    }
    return [200, { dataReferencia: ref, processadas: resultado.length, resultado }];
  }

  // Liga ou desliga a renovação automática de uma apólice (ex.: cliente pediu para não renovar).
  async function alterarRenovacao({ headers, params, body }) {
    exigirAdmin(headers);
    if (!body || typeof body.ativa !== 'boolean') throw new ErroHttp(422, 'Informe { "ativa": true|false }');
    const r = await db.run(`UPDATE propostas SET renovacao_automatica=?, atualizado_em=CURRENT_TIMESTAMP WHERE numero=?`, body.ativa ? 1 : 0, params.numero);
    if (!r.changes) throw new ErroHttp(404, 'Proposta não encontrada');
    return [200, { numeroProposta: params.numero, renovacaoAutomatica: body.ativa }];
  }

  async function listarVencimentos({ headers, query }) {
    exigirAdmin(headers);
    const dias = Math.min(Math.max(Math.trunc(Number(query.dias)) || 90, 1), 3650);
    const rows = await db.all(`SELECT p.numero, cl.nome AS cliente, p.status, p.vigencia_inicio, p.vigencia_fim, p.renovacao_automatica, p.renovacoes
      FROM propostas p JOIN clientes cl ON cl.id=p.cliente_id
      WHERE p.status IN ('ACEITA','APOLICE_EMITIDA') AND p.vigencia_fim<=? ORDER BY p.vigencia_fim`, somarDias(hoje(), dias));
    return [200, rows];
  }

  const rotas = [
    // Rota pública: não expõe a comissão (o percentual fica em /api/admin/comissoes/resumo).
    ['GET', '/api/saude', async () => [200, { ok: true, seguradora: insurer.nome, pagamentos: payments.nome,
      vigenciaAnos: config.vigenciaAnos, renovacaoAutomatica: config.renovacaoAutomatica }]],
    ['POST', '/api/cotacoes', criarCotacao],
    ['POST', '/api/propostas', criarProposta],
    ['GET', '/api/propostas/:numero', consultarProposta],
    ['POST', '/api/pagamentos', pagar],
    ['POST', '/api/webhooks/seguradora', webhookSeguradora],
    ['POST', '/api/webhooks/pagamentos', webhookPagamento],
    ['GET', '/api/admin/comissoes', listarComissoes],
    ['GET', '/api/admin/comissoes/resumo', resumoComissoes],
    ['POST', '/api/admin/comissoes/:id/recebida', marcarRecebida],
    ['POST', '/api/admin/renovacoes/processar', processarRenovacoes],
    ['GET', '/api/admin/vencimentos', listarVencimentos],
    ['POST', '/api/admin/propostas/:numero/renovacao', alterarRenovacao],
  ].map(([m, path, fn]) => ({ m, fn, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$') }));

  // Despacha uma requisição já lida: { method, path, query, headers, body, ip } -> [status, json]
  async function handle(req) {
    const rota = rotas.find(r => r.m === req.method && r.re.test(req.path));
    if (!rota) return [404, { erro: 'Rota não encontrada' }];
    try {
      return await rota.fn({ ...req, params: req.path.match(rota.re).groups || {} });
    } catch (e) {
      if (e.status && e.status < 500) return [e.status, { erro: e.message }];
      console.error(e);
      return [e.status || 500, { erro: e.status ? e.message : 'Erro interno' }];
    }
  }

  return { handle };
};

module.exports.somarAnos = somarAnos;
