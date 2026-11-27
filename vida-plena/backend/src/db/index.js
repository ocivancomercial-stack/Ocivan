'use strict';

// Escolhe o banco. As duas implementações têm a mesma interface (todas assíncronas):
//   get(sql, ...args)  -> primeira linha ou undefined
//   all(sql, ...args)  -> lista de linhas
//   run(sql, ...args)  -> { changes }
//   tx(async b => ...) -> executa numa transação; b tem get/all/run
//   mes(coluna)        -> trecho SQL que extrai 'AAAA-MM' de uma data
//   fechar()
// O SQL usa "?" nos parâmetros e só recursos comuns aos dois bancos.
//
// DATABASE_URL definida -> PostgreSQL (produção). Senão -> SQLite em DB_PATH (desenvolvimento).
async function abrirBanco({ databaseUrl, dbPath, dbSchema }) {
  if (databaseUrl) return require('./postgres').abrir(databaseUrl, { schema: dbSchema });
  return require('./sqlite').abrir(dbPath);
}

module.exports = { abrirBanco };
