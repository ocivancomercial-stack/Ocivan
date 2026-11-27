'use strict';

// Criptografia de dados sensíveis (LGPD), como a declaração de saúde.
//
// AES-256-GCM: cifra e garante que o conteúdo não foi alterado.
// Cada valor é ligado ao registro dono dele ("contexto", ex.: o número da proposta),
// então copiar o texto cifrado de uma proposta para outra não funciona.
//
// Formato gravado no banco: "enc:v1:" + base64(iv de 12 bytes | tag de 16 bytes | texto cifrado)
//
// A chave fica só no servidor, em CHAVE_DADOS_SENSIVEIS (32 bytes em base64). Para gerar:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Guarde uma cópia em local seguro: sem a chave, os dados cifrados não podem ser lidos.

const crypto = require('node:crypto');

const PREFIXO = 'enc:v1:';

function lerChave(base64) {
  const chave = Buffer.from(String(base64 || ''), 'base64');
  if (chave.length !== 32) throw new Error('CHAVE_DADOS_SENSIVEIS deve ter 32 bytes em base64 (veja src/services/cripto.js)');
  return chave;
}

function criarCripto(chaveBase64) {
  const chave = lerChave(chaveBase64);
  return {
    cifrar(texto, contexto) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
      c.setAAD(Buffer.from(String(contexto)));
      const cifrado = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
      return PREFIXO + Buffer.concat([iv, c.getAuthTag(), cifrado]).toString('base64');
    },
    decifrar(valor, contexto) {
      if (!estaCifrado(valor)) return valor; // registro antigo, gravado antes da criptografia
      const bruto = Buffer.from(valor.slice(PREFIXO.length), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', chave, bruto.subarray(0, 12));
      d.setAAD(Buffer.from(String(contexto)));
      d.setAuthTag(bruto.subarray(12, 28));
      return Buffer.concat([d.update(bruto.subarray(28)), d.final()]).toString('utf8');
    },
  };
}

const estaCifrado = v => typeof v === 'string' && v.startsWith(PREFIXO);

// Contexto da declaração de saúde de uma proposta.
const contextoDeclaracao = numeroProposta => `propostas.declaracao_saude:${numeroProposta}`;

module.exports = { criarCripto, estaCifrado, contextoDeclaracao, lerChave };
