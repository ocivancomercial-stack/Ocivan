'use strict';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const config = {
  port: num(process.env.PORT, 3000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  // Banco: com DATABASE_URL usa PostgreSQL (produção); sem ela, SQLite no arquivo DB_PATH (desenvolvimento).
  databaseUrl: process.env.DATABASE_URL || '',
  dbSchema: process.env.DB_SCHEMA || '',
  dbPath: process.env.DB_PATH || './data/vida-plena.db',
  // Chave da criptografia de dados sensíveis (declaração de saúde). Obrigatória em produção.
  chaveDadosSensiveis: process.env.CHAVE_DADOS_SENSIVEIS || '',
  producao: process.env.NODE_ENV === 'production',
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
  // Agendador: roda a renovação uma vez por dia, a partir desta hora (0 a 23), no fuso do negócio.
  agendadorAtivo: (process.env.AGENDADOR_ATIVO || 'true') === 'true',
  renovacaoHora: num(process.env.RENOVACAO_HORA, 3),
  fusoHorario: process.env.FUSO_HORARIO || 'America/Sao_Paulo',

  insurer: process.env.INSURER || 'mock',
  tokio: {
    baseUrl: process.env.TOKIO_BASE_URL || '',
    clientId: process.env.TOKIO_CLIENT_ID || '',
    clientSecret: process.env.TOKIO_CLIENT_SECRET || '',
    susep: process.env.CORRETOR_SUSEP || '',
  },
  // Cobrança no cartão: "mock" (simulação) ou "tokio" (plataforma da Tokio Marine; exige INSURER=tokio)
  payments: process.env.PAYMENTS || 'mock',

  iof: 0.0038,           // IOF sobre seguro de pessoas
  descontoAnual: 0.05,   // desconto no pagamento anual
};

if (!(config.comissaoPercentual > 0 && config.comissaoPercentual < 100)) {
  throw new Error('COMISSAO_PERCENTUAL inválido: use um número entre 0 e 100');
}

if (!(Number.isInteger(config.renovacaoHora) && config.renovacaoHora >= 0 && config.renovacaoHora <= 23)) {
  throw new Error('RENOVACAO_HORA inválida: use um número inteiro de 0 a 23');
}
if (!require('./services/datas').fusoValido(config.fusoHorario)) throw new Error(`FUSO_HORARIO inválido: ${config.fusoHorario}`);
if ((config.databaseUrl || config.producao) && !config.chaveDadosSensiveis) {
  throw new Error('Defina CHAVE_DADOS_SENSIVEIS: em produção a declaração de saúde precisa ser gravada criptografada (LGPD)');
}
if (config.chaveDadosSensiveis) require('./services/cripto').lerChave(config.chaveDadosSensiveis); // valida o formato na subida
if (config.producao && !config.databaseUrl) {
  throw new Error('Em produção (NODE_ENV=production) use PostgreSQL: defina DATABASE_URL');
}

module.exports = config;
