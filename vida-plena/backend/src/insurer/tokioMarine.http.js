'use strict';

// Integração REAL com a Tokio Marine — esqueleto.
// Os caminhos, nomes de campos e autenticação abaixo são SUPOSIÇÕES e devem
// ser ajustados conforme a documentação que a Tokio entregar. A interface
// (cotar / emitirProposta / consultarProposta) não muda, então o resto do
// sistema não precisa ser alterado.

module.exports = function tokioHttp(config) {
  const { baseUrl, clientId, clientSecret, susep } = config.tokio;
  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error('INSURER=tokio exige TOKIO_BASE_URL, TOKIO_CLIENT_ID e TOKIO_CLIENT_SECRET');
  }

  let token = null, expira = 0;
  async function auth() {
    if (token && Date.now() < expira - 60_000) return token;
    // Suposição: OAuth2 client_credentials
    const r = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    if (!r.ok) throw new Error(`Tokio auth falhou: ${r.status}`);
    const j = await r.json();
    token = j.access_token; expira = Date.now() + j.expires_in * 1000;
    return token;
  }

  async function call(method, path, body) {
    const r = await fetch(baseUrl + path, {
      method,
      headers: { authorization: `Bearer ${await auth()}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.mensagem || `Tokio ${method} ${path}: ${r.status}`); e.status = 502; throw e; }
    return j;
  }

  return {
    nome: 'tokio-http',

    async cotar(e) {
      const j = await call('POST', '/vida-individual/v1/cotacoes', {
        corretor: { susep, percentualCorretagem: config.comissaoPercentual },
        segurado: { dataNascimento: e.nascimento, sexo: e.sexo, fumante: e.fumante, profissao: e.profissao, uf: e.uf },
        coberturas: e.coberturas.map(c => ({ codigo: c.id, capitalSegurado: c.capital })),
      });
      // TODO: mapear a resposta real para o formato interno
      return {
        idCotacao: j.id, idade: j.idade, itens: j.coberturas,
        premioLiquido: j.premioLiquido, iof: j.iof, premioMensal: j.premioTotal,
        premioAnual: j.premioAnual, validaAte: j.validade, comissaoMaxima: j.corretagemMaxima,
      };
    },

    async emitirProposta(p) {
      const j = await call('POST', '/vida-individual/v1/propostas', {
        cotacaoId: p.idCotacao,
        corretor: { susep, percentualCorretagem: p.comissaoPercentual },
        proponente: p.proponente,
        beneficiarios: p.beneficiarios,
        declaracaoSaude: p.declaracaoSaude,
        periodicidade: p.periodicidade,
        vigencia: p.vigencia, // { inicio, fim, anos, renovacaoAutomatica }
      });
      return { numeroProposta: j.numero, status: j.status };
    },

    async renovar({ numeroProposta, novaVigenciaInicio, novaVigenciaFim }) {
      // Suposição de rota: ajustar à documentação da Tokio
      const j = await call('POST', `/vida-individual/v1/apolices/${encodeURIComponent(numeroProposta)}/renovacao`, {
        vigencia: { inicio: novaVigenciaInicio, fim: novaVigenciaFim },
      });
      return { status: j.status, motivo: j.motivo };
    },

    async consultarProposta(numero) {
      const j = await call('GET', `/vida-individual/v1/propostas/${encodeURIComponent(numero)}`);
      return { numeroProposta: j.numero, status: j.status, numeroApolice: j.numeroApolice };
    },
  };
};
