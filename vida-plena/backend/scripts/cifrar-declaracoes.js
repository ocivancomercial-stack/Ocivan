'use strict';

// Cifra as declarações de saúde gravadas em texto puro (criadas antes da criptografia
// ou em desenvolvimento sem CHAVE_DADOS_SENSIVEIS). Pode rodar várias vezes: o que já
// está cifrado é ignorado.
//   npm run db:cifrar
// Usa o mesmo banco do servidor (DATABASE_URL ou DB_PATH) e exige CHAVE_DADOS_SENSIVEIS.

const config = require('../src/config');
const { abrirBanco } = require('../src/db');
const { criarCripto, estaCifrado, contextoDeclaracao } = require('../src/services/cripto');

(async () => {
  if (!config.chaveDadosSensiveis) throw new Error('Defina CHAVE_DADOS_SENSIVEIS');
  const cripto = criarCripto(config.chaveDadosSensiveis);
  const db = await abrirBanco(config);
  try {
    const linhas = await db.all('SELECT numero, declaracao_saude_json FROM propostas');
    let cifradas = 0;
    for (const { numero, declaracao_saude_json: valor } of linhas) {
      if (estaCifrado(valor)) continue;
      JSON.parse(valor); // garante que é a declaração em JSON antes de cifrar
      const r = await db.run('UPDATE propostas SET declaracao_saude_json=? WHERE numero=? AND declaracao_saude_json=?',
        cripto.cifrar(valor, contextoDeclaracao(numero)), numero, valor);
      cifradas += r.changes;
    }
    console.log(`Banco ${db.dialeto}: ${cifradas} declaração(ões) cifrada(s); ${linhas.length - cifradas} já estavam cifradas.`);
  } finally {
    await db.fechar();
  }
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
