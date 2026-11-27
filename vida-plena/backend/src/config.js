'use strict';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const config = {
  port: num(process.env.PORT, 3000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  dbPath: process.env.DB_PATH || './data/vida-plena.db',
  // Pasta do app servido em http://localhost:PORT/ (mesma origem da API).
  frontendDir: process.env.FRONTEND_DIR || require('node:path').join(__dirname, '..', '..', 'frontend'),
  adminToken: process.env.ADMIN_TOKEN || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',

  // Programa de comissão: percentual único para todos os casos.
  // Incide sobre o prêmio líquido (sem IOF) de cada pagamento aprovado.
  comissaoPercentual: num(process.env.COMISSAO_PERCENTUAL, 30),

  // Vigência: 5 anos com renovação automática (produto Vida Individual)
  vigenciaAnos: num(process.env.VIGENCIA_ANOS, 5),
  renovacaoAutomatica: (process.env.RENOVACAO_AUTOMATICA || 'true') === 'true',
  renovacaoAntecedenciaDias: num(process.env.RENOVACAO_ANTECEDENCIA_DIAS, 30),

  insurer: process.env.INSURER || 'mock',
  tokio: {
    baseUrl: process.env.TOKIO_BASE_URL || '',
    clientId: process.env.TOKIO_CLIENT_ID || '',
    clientSecret: process.env.TOKIO_CLIENT_SECRET || '',
    susep: process.env.CORRETOR_SUSEP || '',
  },
  payments: process.env.PAYMENTS || 'mock',
  gatewayApiKey: process.env.GATEWAY_API_KEY || '',

  iof: 0.0038,           // IOF sobre seguro de pessoas
  descontoAnual: 0.05,   // desconto no pagamento anual
};

if (!(config.comissaoPercentual > 0 && config.comissaoPercentual < 100)) {
  throw new Error('COMISSAO_PERCENTUAL inválido: use um número entre 0 e 100');
}

module.exports = config;
