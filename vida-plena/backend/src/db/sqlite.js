'use strict';

// Banco SQLite: usado no desenvolvimento e nos testes (nada para instalar).
// Em produção, use PostgreSQL (DATABASE_URL). A interface é a mesma: veja ./index.js.

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cpf TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  nascimento TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cotacoes (
  id TEXT PRIMARY KEY,                 -- id devolvido pela seguradora
  entrada_json TEXT NOT NULL,          -- dados e coberturas pedidos
  resposta_json TEXT NOT NULL,         -- resposta completa da seguradora
  premio_liquido REAL NOT NULL,
  iof REAL NOT NULL,
  premio_mensal REAL NOT NULL,
  premio_anual REAL NOT NULL,
  valida_ate TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS propostas (
  numero TEXT PRIMARY KEY,
  cotacao_id TEXT NOT NULL REFERENCES cotacoes(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  beneficiarios TEXT NOT NULL,
  declaracao_saude_json TEXT NOT NULL,  -- dado sensível (LGPD)
  periodicidade TEXT NOT NULL CHECK (periodicidade IN ('mensal','anual')),
  status TEXT NOT NULL,                 -- ACEITA, EM_ANALISE_SUBSCRICAO, RECUSADA, APOLICE_EMITIDA, CANCELADA
  numero_apolice TEXT,
  comissao_percentual REAL NOT NULL,    -- guardado por proposta: mudar a config não altera o histórico
  aceites_json TEXT NOT NULL,
  aceites_ip TEXT,
  vigencia_inicio TEXT,
  vigencia_fim TEXT,
  renovacao_automatica INTEGER NOT NULL DEFAULT 1,
  renovacoes INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposta_numero TEXT NOT NULL REFERENCES propostas(numero),
  valor REAL NOT NULL,                 -- valor cobrado (com IOF)
  premio_liquido REAL NOT NULL,        -- parte sem IOF, base da comissão
  parcelas INTEGER NOT NULL,
  recorrente INTEGER NOT NULL,
  status TEXT NOT NULL,                -- APROVADO, RECUSADO, ESTORNADO
  autorizacao TEXT,
  cartao_final TEXT,
  cartao_bandeira TEXT,
  motivo TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comissoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposta_numero TEXT NOT NULL REFERENCES propostas(numero),
  pagamento_id INTEGER NOT NULL UNIQUE REFERENCES pagamentos(id),
  base_calculo REAL NOT NULL,          -- prêmio líquido do pagamento
  percentual REAL NOT NULL,
  valor REAL NOT NULL,
  status TEXT NOT NULL,                -- PREVISTA, A_RECEBER, RECEBIDA, CANCELADA
  recebida_em TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS renovacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposta_numero TEXT NOT NULL REFERENCES propostas(numero),
  vigencia_anterior_fim TEXT NOT NULL,
  nova_vigencia_inicio TEXT NOT NULL,
  nova_vigencia_fim TEXT NOT NULL,
  status TEXT NOT NULL,                -- RENOVADA, NAO_RENOVADA
  motivo TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agendamentos (
  tarefa TEXT NOT NULL,                -- ex.: renovacoes
  data_referencia TEXT NOT NULL,       -- dia (AAAA-MM-DD) no fuso do negócio
  status TEXT NOT NULL,                -- EXECUTANDO, CONCLUIDA, ERRO
  iniciado_em TEXT NOT NULL,           -- ISO, UTC
  concluido_em TEXT,
  resultado_json TEXT,
  PRIMARY KEY (tarefa, data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_status ON comissoes(status);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas(status);
`;

// Abre (e cria, se preciso) o banco SQLite e devolve a interface comum.
function abrir(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  migrar(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_propostas_vigencia ON propostas(vigencia_fim)');

  const exec = {
    get: (sql, args) => db.prepare(sql).get(...args),
    all: (sql, args) => db.prepare(sql).all(...args),
    run: (sql, args) => ({ changes: Number(db.prepare(sql).run(...args).changes) }),
  };

  // O SQLite tem uma conexão só. Enquanto uma transação está aberta, as outras
  // operações esperam na fila, para não entrarem no meio dela.
  let fila = Promise.resolve();
  function naFila(fn) {
    const anterior = fila;
    let liberar;
    fila = new Promise(r => { liberar = r; });
    return anterior.then(fn).finally(liberar);
  }
  const semFila = {
    get: async (sql, ...args) => exec.get(sql, args),
    all: async (sql, ...args) => exec.all(sql, args),
    run: async (sql, ...args) => exec.run(sql, args),
  };

  return {
    dialeto: 'sqlite',
    get: (sql, ...args) => naFila(() => exec.get(sql, args)),
    all: (sql, ...args) => naFila(() => exec.all(sql, args)),
    run: (sql, ...args) => naFila(() => exec.run(sql, args)),
    tx: fn => naFila(async () => {
      db.exec('BEGIN');
      try { const r = await fn(semFila); db.exec('COMMIT'); return r; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    }),
    mes: coluna => `strftime('%Y-%m', ${coluna})`,
    fechar: async () => db.close(),
  };
}

// Acrescenta colunas novas em bancos criados por versões anteriores.
function migrar(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(propostas)').all().map(c => c.name));
  const novas = [
    ['vigencia_inicio', 'TEXT'], ['vigencia_fim', 'TEXT'],
    ['renovacao_automatica', 'INTEGER NOT NULL DEFAULT 1'], ['renovacoes', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [nome, tipo] of novas) if (!cols.has(nome)) db.exec(`ALTER TABLE propostas ADD COLUMN ${nome} ${tipo}`);
}

module.exports = { abrir };
