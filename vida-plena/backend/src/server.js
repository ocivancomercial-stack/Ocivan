'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { abrirBanco } = require('./db');
const { criarAgendador } = require('./agendador');
const insurer = require('./insurer')(config);
const payments = require('./payments')(config, { insurer });
let app; // criado depois que o banco abre (veja iniciar())

const LIMITE_CORPO = 100 * 1024;

// O app (front-end) é servido pelo próprio servidor, na mesma origem da API: sem CORS.
const PASTA_APP = path.resolve(config.frontendDir);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json' };

// Endereços amigáveis
const ATALHOS = { '/admin': '/admin.html', '/admin/': '/admin.html' };

// Política de segurança do painel do corretor: ele guarda o token de admin, então só roda
// o script do próprio servidor (admin.js) e só fala com a própria API.
const CSP_ADMIN = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function servirApp(pathname, res) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = ''; }
  rel = ATALHOS[rel] || rel;
  if (rel.endsWith('/')) rel += 'index.html';
  const arq = path.resolve(PASTA_APP, '.' + rel);
  const tipo = TIPOS[path.extname(arq).toLowerCase()];
  // Bloqueia saída da pasta do app e arquivos de tipos não previstos.
  if (!arq.startsWith(PASTA_APP + path.sep) || !tipo) return false;
  let corpo;
  try { corpo = fs.readFileSync(arq); } catch { return false; }
  const painel = path.basename(arq).startsWith('admin.');
  res.writeHead(200, { 'content-type': tipo, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'cache-control': tipo.startsWith('text/html') || painel ? 'no-cache' : 'public, max-age=3600',
    ...(painel && tipo.startsWith('text/html') ? { 'content-security-policy': CSP_ADMIN, 'x-frame-options': 'DENY' } : {}) });
  res.end(corpo);
  return true;
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on('data', c => { tam += c.length; if (tam > LIMITE_CORPO) { reject(Object.assign(new Error('Corpo muito grande'), { status: 413 })); req.destroy(); } else partes.push(c); });
    req.on('end', () => {
      if (!partes.length) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = origin && config.corsOrigins.includes(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' }
    : {};
  const enviar = (status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...cors });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  try {
    const url = new URL(req.url, 'http://localhost');
    if ((req.method === 'GET' || req.method === 'HEAD') && !url.pathname.startsWith('/api/')) {
      if (servirApp(url.pathname, res)) return;
      return enviar(404, { erro: 'Arquivo não encontrado' });
    }
    const body = req.method === 'POST' ? await lerCorpo(req) : undefined;
    const [status, json] = await app.handle({
      method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams),
      headers: req.headers, body, ip: req.socket.remoteAddress,
    });
    enviar(status, json);
  } catch (e) {
    enviar(e.status || 500, { erro: e.status ? e.message : 'Erro interno' });
  }
});

async function iniciar() {
  const db = await abrirBanco(config);
  app = require('./app')({ config, db, insurer, payments });
  const agendador = config.agendadorAtivo
    ? criarAgendador({ db, tarefa: 'renovacoes', hora: config.renovacaoHora, fusoHorario: config.fusoHorario, executar: data => app.renovarVencendo(data) })
    : null;
  server.listen(config.port, () => {
    console.log(`App e API em http://localhost:${config.port} · banco=${db.dialeto} · seguradora=${insurer.nome} · pagamentos=${payments.nome} · comissão=${config.comissaoPercentual}%`);
    if (agendador) {
      agendador.iniciar();
      console.log(`Renovação automática: todo dia a partir das ${config.renovacaoHora}h (${config.fusoHorario})`);
    } else console.log('Renovação automática: agendador desligado (AGENDADOR_ATIVO=false)');
  });
  // Desligamento limpo (deploy, reinício): para o agendador, as conexões e fecha o banco.
  const desligar = () => {
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(async () => { await agendador?.parar(); await db.fechar(); process.exit(0); });
  };
  process.on('SIGTERM', desligar);
  process.on('SIGINT', desligar);
}

iniciar().catch(e => { console.error('Falha ao iniciar:', e.message); process.exit(1); });
