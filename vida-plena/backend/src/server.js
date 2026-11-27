'use strict';

const http = require('node:http');
const config = require('./config');
const db = require('./db').open(config.dbPath);
const insurer = require('./insurer')(config);
const payments = require('./payments')(config);
const app = require('./app')({ config, db, insurer, payments });

const LIMITE_CORPO = 100 * 1024;

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

server.listen(config.port, () => {
  console.log(`API em http://localhost:${config.port} · seguradora=${insurer.nome} · pagamentos=${payments.nome} · comissão=${config.comissaoPercentual}%`);
});
