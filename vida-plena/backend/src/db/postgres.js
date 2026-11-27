'use strict';

// Banco PostgreSQL: usado em produção (DATABASE_URL). Mesma interface do SQLite: veja ./index.js.

const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf8');

// Tipos devolvidos no mesmo formato do SQLite, para o resto do sistema não mudar.
const PARSERS = {
  1700: v => Number(v),           // NUMERIC -> número (valores em reais, até 2 casas)
  20: v => Number(v),             // BIGINT (ex.: COUNT) -> número
  1082: v => v,                   // DATE -> 'AAAA-MM-DD'
};
const types = { getTypeParser: (oid, formato) => PARSERS[oid] || pg.types.getTypeParser(oid, formato) };

// O código escreve SQL com "?" (como no SQLite); o PostgreSQL usa $1, $2...
const converter = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };

async function abrir(url, { schema } = {}) {
  if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Nome de schema inválido');
  const pool = new pg.Pool({
    connectionString: url,
    max: 10,
    types,
    options: `-c TimeZone=UTC${schema ? ` -c search_path=${schema}` : ''}`,
  });
  pool.on('error', e => console.error('PostgreSQL: erro em conexão ociosa:', e.message));

  if (schema) await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await pool.query(SCHEMA);

  const com = cliente => ({
    get: async (sql, ...args) => (await cliente.query(converter(sql), args)).rows[0],
    all: async (sql, ...args) => (await cliente.query(converter(sql), args)).rows,
    run: async (sql, ...args) => ({ changes: (await cliente.query(converter(sql), args)).rowCount }),
  });

  return {
    dialeto: 'postgres',
    ...com(pool),
    async tx(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const r = await fn(com(cliente));
        await cliente.query('COMMIT');
        return r;
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        cliente.release();
      }
    },
    mes: coluna => `to_char(${coluna}, 'YYYY-MM')`,
    fechar: () => pool.end(),
    _pool: pool,
  };
}

module.exports = { abrir };
