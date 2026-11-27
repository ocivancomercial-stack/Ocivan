'use strict';
// Painel do corretor (Vida Plena). Usa as rotas /api/admin/* com o cabeçalho x-admin-token.
// O token fica só nesta aba (sessionStorage) e some ao fechá-la.
// Todo texto vindo do banco passa por esc(): nomes de clientes são digitados pelo público.
(() => {
  const CHAVE_TOKEN = 'vp_admin_token';
  const FUSO = 'America/Sao_Paulo';
  const S = { token: lerToken(), aba: 'resumo', filtrosCom: { status: '', de: '', ate: '' }, filtrosProp: { status: '', busca: '' }, dias: 90, lista: [] };
  const $ = id => document.getElementById(id);
  const raiz = $('raiz');

  /* ---------- utilitários ---------- */
  function lerToken() { try { return sessionStorage.getItem(CHAVE_TOKEN) || ''; } catch { return ''; } }
  function gravarToken(t) { try { t ? sessionStorage.setItem(CHAVE_TOKEN, t) : sessionStorage.removeItem(CHAVE_TOKEN); } catch {} }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlCurto = v => v >= 10000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v).replace(/,00$/, '');
  const dataBR = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—';
  // Momentos vêm em ISO (PostgreSQL) ou "AAAA-MM-DD HH:MM:SS" em UTC (SQLite).
  function momentoBR(s) {
    if (!s) return '—';
    let t = String(s);
    if (!/[zZ]|[+-]\d\d:?\d\d$/.test(t)) t = t.replace(' ', 'T') + 'Z';
    const d = new Date(t);
    return isNaN(d) ? esc(s) : d.toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });
  }
  const mesBR = m => { const [a, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1] + '/' + a.slice(2); };
  const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());

  const ROT_COM = { PREVISTA: ['Prevista', ''], A_RECEBER: ['A receber', 'warn'], RECEBIDA: ['Recebida', 'ok'], CANCELADA: ['Cancelada', 'no'] };
  const ROT_PROP = { ACEITA: ['Aceita', 'ok'], EM_ANALISE_SUBSCRICAO: ['Em análise', 'warn'], RECUSADA: ['Recusada', 'no'], APOLICE_EMITIDA: ['Apólice emitida', 'ok'], CANCELADA: ['Cancelada', 'no'] };
  const ROT_EXEC = { CONCLUIDA: ['Concluída', 'ok'], EXECUTANDO: ['Executando', ''], ERRO: ['Erro', 'warn'] };
  const pill = (mapa, v) => { const [t, c] = mapa[v] || [v, '']; return `<span class="pill ${c}">${esc(t)}</span>`; };

  async function api(metodo, rota, corpo) {
    const r = await fetch(rota, { method: metodo, headers: { 'x-admin-token': S.token, ...(corpo ? { 'content-type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { sair('Sessão expirada ou token inválido. Entre de novo.'); throw new Error('Não autorizado'); }
    if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
    return j;
  }
  const qs = o => { const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)); return p.toString() ? '?' + p : ''; };

  /* ---------- login ---------- */
  function telaLogin(msg = '') {
    raiz.innerHTML = `<div class="login"><div class="card">
      <div class="brand" style="color:var(--b)">${ESCUDO}Vida Plena</div>
      <h1 style="margin-top:14px">Painel do corretor</h1>
      <p class="sub">Comissões, propostas e renovações. Use o token de administrador (ADMIN_TOKEN do servidor).</p>
      <form id="flogin"><label for="tok">Token de administrador</label>
      <input id="tok" type="password" autocomplete="current-password" required>
      <div class="erro" id="lerro">${esc(msg)}</div>
      <button class="btn" type="submit">Entrar</button></form></div></div>`;
    $('tok').focus();
    $('flogin').onsubmit = async e => {
      e.preventDefault();
      S.token = $('tok').value.trim();
      try {
        const r = await fetch('/api/admin/comissoes/resumo', { headers: { 'x-admin-token': S.token } });
        if (r.status === 401) { $('lerro').textContent = 'Token inválido.'; return; }
        if (!r.ok) { $('lerro').textContent = `Erro ${r.status} no servidor.`; return; }
        gravarToken(S.token); telaPainel();
      } catch { $('lerro').textContent = 'Não foi possível falar com o servidor.'; }
    };
  }
  function sair(msg) { S.token = ''; gravarToken(''); telaLogin(msg); }

  /* ---------- estrutura ---------- */
  const ESCUDO = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3z" fill="currentColor"/><path d="M12 16.5s-4-2.5-4-5.2A2.2 2.2 0 0112 10a2.2 2.2 0 014 1.3c0 2.7-4 5.2-4 5.2z" fill="#fff" opacity=".9"/></svg>';
  const ABAS = [['resumo', 'Resumo'], ['comissoes', 'Comissões'], ['propostas', 'Propostas'], ['renovacoes', 'Renovações']];

  function telaPainel() {
    raiz.innerHTML = `<header class="top"><div class="in"><div class="brand">${ESCUDO}<span>Vida Plena <small>· Painel do corretor</small></span></div>
      <button class="sair" id="bsair">Sair</button></div>
      <nav aria-label="Seções">${ABAS.map(([id, t]) => `<button data-aba="${id}">${t}</button>`).join('')}</nav></header>
      <main id="conteudo"></main>`;
    $('bsair').onclick = () => sair();
    raiz.querySelector('nav').onclick = e => { const b = e.target.closest('[data-aba]'); if (b) abrir(b.dataset.aba); };
    abrir(S.aba);
  }
  function abrir(aba) {
    S.aba = aba;
    raiz.querySelectorAll('nav [data-aba]').forEach(b => { if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('conteudo').innerHTML = '<p class="sub">Carregando…</p>';
    ({ resumo, comissoes, propostas, renovacoes })[aba]().catch(e => { if (e.message !== 'Não autorizado') $('conteudo').innerHTML = `<p class="erro">${esc(e.message)}</p>`; });
  }

  /* ---------- Resumo ---------- */
  async function resumo() {
    const [r, venc, exec] = await Promise.all([api('GET', '/api/admin/comissoes/resumo'), api('GET', '/api/admin/vencimentos?dias=90'), api('GET', '/api/admin/agendamentos')]);
    const st = Object.fromEntries(r.porStatus.map(x => [x.status, x]));
    const kpi = (status, titulo, nota) => { const x = st[status] || { total: 0, quantidade: 0 };
      return `<div class="kpi"><span>${titulo}</span><b>${brl(x.total)}</b><small>${x.quantidade} comissão(ões) · ${nota}</small></div>`; };
    const ultima = exec.find(e => e.tarefa === 'renovacoes');
    const meses = [...r.porMes].reverse(); // mais antigo à esquerda
    $('conteudo').innerHTML = `<h1>Resumo</h1><p class="sub">Comissão de ${esc(r.percentualVigente)}% sobre o prêmio líquido de cada pagamento aprovado.</p>
      <div class="kpis">${kpi('A_RECEBER', 'A receber', 'aguardando repasse da Tokio')}${kpi('RECEBIDA', 'Recebidas', 'repasse conferido')}
      ${kpi('PREVISTA', 'Previstas', 'propostas em análise')}${kpi('CANCELADA', 'Canceladas', 'recusa ou estorno')}</div>
      <div class="grid2"><section class="card"><h2>Comissões por mês</h2><p class="sub" style="margin-top:-8px">Últimos 12 meses, sem as canceladas.</p>
        ${meses.length ? `<div class="grafico" id="graf"></div><details class="tab"><summary>Ver em tabela</summary><div class="tabela" style="margin-top:8px"><table>
          <thead><tr><th>Mês</th><th class="n">Comissões</th></tr></thead><tbody>${meses.map(m => `<tr><td>${mesBR(m.mes)}</td><td class="n">${brl(m.total)}</td></tr>`).join('')}</tbody></table></div></details>`
          : '<p class="vazio">Nenhuma comissão ainda.</p>'}</section>
      <section><div class="card"><h2>Vencimentos (90 dias)</h2><b style="font-size:26px">${venc.length}</b> apólice(s) vencendo
        <p class="sub" style="margin:6px 0 0">${venc.filter(v => !v.renovacao_automatica).length} com renovação automática desligada. <a class="link" data-ir="renovacoes">Ver renovações</a></p></div>
        <div class="card"><h2>Renovação automática</h2>${ultima ? `<div class="linha"><span>Última execução</span><span>${dataBR(ultima.data_referencia)}</span></div>
          <div class="linha"><span>Situação</span>${pill(ROT_EXEC, ultima.status)}</div>
          <div class="linha"><span>Apólices processadas</span><span>${ultima.resultado?.processadas ?? '—'}</span></div>` : '<p class="sub">Ainda não executou.</p>'}</div></section></div>`;
    $('conteudo').querySelector('[data-ir]').onclick = () => abrir('renovacoes');
    if (meses.length) grafico($('graf'), meses);
  }

  // Colunas de um só tom (uma série: o título já diz o que é, sem legenda). Rótulo só no mês mais recente;
  // os outros valores ficam no eixo, na dica ao passar o mouse e na tabela.
  function grafico(el, meses) {
    // Desenhado na largura real do quadro (o texto não encolhe no celular) e redesenhado se ela mudar.
    const L = Math.max(300, Math.round(el.clientWidth || 640)), A = 240, m = { e: 64, d: 12, t: 22, b: 28 }, w = L - m.e - m.d, h = A - m.t - m.b;
    el.dataset.larg = L;
    const max = Math.max(...meses.map(x => x.total), 1);
    const passo = escalaLimpa(max), topo = Math.ceil(max / passo) * passo;
    const y = v => m.t + h - (v / topo) * h, banda = w / meses.length, larg = Math.min(24, banda * 0.6);
    let svg = `<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Comissões por mês, últimos ${meses.length} meses">`;
    for (let v = 0; v <= topo + 1e-9; v += passo) {
      svg += `<line class="grade" x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}"/>
        <text class="eixo" x="${m.e - 8}" y="${y(v) + 4}" text-anchor="end">${esc(brlCurto(v))}</text>`;
    }
    meses.forEach((x, i) => {
      const cx = m.e + banda * i + banda / 2, x0 = cx - larg / 2, yt = y(x.total), alt = m.t + h - yt, r = Math.min(4, alt);
      if (alt > 0.5) svg += `<path d="M${x0} ${m.t + h}V${yt + r}Q${x0} ${yt} ${x0 + r} ${yt}H${x0 + larg - r}Q${x0 + larg} ${yt} ${x0 + larg} ${yt + r}V${m.t + h}Z" class="barra"/>`;
      if (banda >= 34 || i % 2 === (meses.length - 1) % 2) svg += `<text class="eixo" x="${cx}" y="${A - 8}" text-anchor="middle">${mesBR(x.mes)}</text>`;
      if (i === meses.length - 1) svg += `<text class="rot" x="${cx}" y="${yt - 6}" text-anchor="middle">${esc(brl(x.total))}</text>`;
      svg += `<rect x="${m.e + banda * i}" y="${m.t}" width="${banda}" height="${h}" class="alvo" data-i="${i}" tabindex="0" aria-label="${mesBR(x.mes)}: ${esc(brl(x.total))}"/>`;
    });
    el.innerHTML = svg + '</svg><div class="dica" id="dica"></div>';
    const dica = el.querySelector('#dica'), s = el.querySelector('svg');
    const mostrar = alvo => {
      const i = alvo?.dataset?.i; if (i == null) { dica.style.display = 'none'; return; }
      const x = meses[+i], k = s.getBoundingClientRect().width / L;
      dica.innerHTML = `<b>${mesBR(x.mes)}</b> · ${esc(brl(x.total))}`;
      dica.style.left = (m.e + banda * i + banda / 2) * k + 'px'; dica.style.top = y(x.total) * k + 'px'; dica.style.display = 'block';
    };
    s.addEventListener('pointermove', e => mostrar(e.target)); s.addEventListener('pointerleave', () => mostrar(null));
    s.addEventListener('focusin', e => mostrar(e.target)); s.addEventListener('focusout', () => mostrar(null));
    if (!el._obs) {
      el._obs = new ResizeObserver(() => { if (Math.abs(el.clientWidth - el.dataset.larg) > 8) grafico(el, meses); });
      el._obs.observe(el);
    }
  }
  function escalaLimpa(max) { const bruto = max / 4, p = 10 ** Math.floor(Math.log10(bruto)); return [1, 2, 2.5, 5, 10].map(f => f * p).find(v => v >= bruto); }

  /* ---------- Comissões ---------- */
  async function comissoes() {
    const f = S.filtrosCom;
    const lista = await api('GET', '/api/admin/comissoes' + qs(f));
    S.lista = lista;
    const total = lista.filter(c => c.status !== 'CANCELADA').reduce((s, c) => s + c.valor, 0);
    $('conteudo').innerHTML = `<h1>Comissões</h1><p class="sub">Uma comissão por pagamento aprovado (mensalidade ou anuidade). Marque como recebida quando conferir o repasse da Tokio.</p>
      <form class="filtros" id="fcom"><label>Status<select name="status"><option value="">Todos</option>${Object.entries(ROT_COM).map(([k, [t]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>De<input type="date" name="de" value="${esc(f.de)}"></label><label>Até<input type="date" name="ate" value="${esc(f.ate)}"></label>
        <button class="btn" type="submit">Filtrar</button><button class="btn sec" type="button" id="bcsv" ${lista.length ? '' : 'disabled'}>Exportar planilha (CSV)</button></form>
      <div class="erro" id="cerro"></div>
      <div class="tabela"><table><thead><tr><th>Data</th><th>Proposta</th><th>Cliente</th><th>Plano</th><th class="n">Base</th><th class="n">%</th><th class="n">Comissão</th><th>Status</th><th></th></tr></thead>
      <tbody>${lista.length ? lista.map(c => `<tr><td>${momentoBR(c.criado_em)}</td><td>${esc(c.proposta_numero)}<small>${pill(ROT_PROP, c.status_proposta)}</small></td>
        <td>${esc(c.cliente)}</td><td>${c.periodicidade === 'anual' ? 'Anual' : 'Mensal'}</td><td class="n">${brl(c.base_calculo)}</td><td class="n">${esc(c.percentual)}%</td>
        <td class="n"><b>${brl(c.valor)}</b></td><td>${pill(ROT_COM, c.status)}${c.recebida_em ? `<small>em ${momentoBR(c.recebida_em)}</small>` : ''}</td>
        <td>${c.status === 'A_RECEBER' ? `<button class="btn peq" data-receber="${esc(c.id)}">Marcar recebida</button>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="9" class="vazio">Nenhuma comissão com esses filtros.</td></tr>'}</tbody>
      ${lista.length ? `<tfoot><tr><td colspan="6">Total (sem canceladas) · ${lista.length} linha(s)${lista.length === 500 ? ' · mostrando as 500 mais recentes' : ''}</td><td class="n">${brl(total)}</td><td colspan="2"></td></tr></tfoot>` : ''}</table></div>`;
    $('fcom').onsubmit = e => { e.preventDefault(); const d = new FormData(e.target); S.filtrosCom = { status: d.get('status'), de: d.get('de'), ate: d.get('ate') }; abrir('comissoes'); };
    $('bcsv').onclick = () => exportarCsv(lista);
    $('conteudo').querySelector('tbody').onclick = async e => {
      const b = e.target.closest('[data-receber]'); if (!b) return;
      b.disabled = true;
      try { await api('POST', `/api/admin/comissoes/${encodeURIComponent(b.dataset.receber)}/recebida`); abrir('comissoes'); }
      catch (err) { b.disabled = false; $('cerro').textContent = err.message; }
    };
  }

  // CSV para Excel em português: separador ";" e vírgula decimal. Células que começam com = + - @
  // ganham um apóstrofo, para a planilha não executar fórmulas vindas de nomes digitados por clientes.
  function exportarCsv(lista) {
    const cel = v => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const num = v => Number(v).toFixed(2).replace('.', ',');
    const linhas = [['Data', 'Proposta', 'Cliente', 'Plano', 'Status da proposta', 'Base de cálculo', 'Percentual', 'Comissão', 'Status', 'Recebida em']]
      .concat(lista.map(c => [momentoBR(c.criado_em), c.proposta_numero, c.cliente, c.periodicidade, c.status_proposta, num(c.base_calculo), num(c.percentual), num(c.valor), c.status, c.recebida_em ? momentoBR(c.recebida_em) : '']));
    const blob = new Blob(['﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `comissoes-${hojeISO()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- Propostas ---------- */
  async function propostas() {
    const f = S.filtrosProp;
    const lista = await api('GET', '/api/admin/propostas' + qs(f));
    $('conteudo').innerHTML = `<h1>Propostas</h1><p class="sub">A declaração de saúde nunca aparece aqui: ela fica criptografada no banco.</p>
      <form class="filtros" id="fprop"><label>Buscar<input name="busca" value="${esc(f.busca)}" placeholder="Nome, proposta ou CPF" maxlength="80"></label>
        <label>Status<select name="status"><option value="">Todos</option>${Object.entries(ROT_PROP).map(([k, [t]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <button class="btn" type="submit">Buscar</button></form>
      <div class="tabela"><table><thead><tr><th>Proposta</th><th>Cliente</th><th>Status</th><th class="n">Valor</th><th>Vigência</th><th>Renovação</th><th class="n">Comissão acumulada</th><th>Criada em</th></tr></thead>
      <tbody>${lista.length ? lista.map(p => `<tr><td>${esc(p.numero)}${p.numero_apolice ? `<small>Apólice ${esc(p.numero_apolice)}</small>` : ''}</td>
        <td>${esc(p.cliente)}<small>${esc(p.cpf)} · ${esc(p.email)}</small></td><td>${pill(ROT_PROP, p.status)}</td>
        <td class="n">${brl(p.valor)}<small>${p.periodicidade === 'anual' ? 'por ano' : 'por mês'}</small></td>
        <td>${dataBR(p.vigencia_inicio)} a ${dataBR(p.vigencia_fim)}</td>
        <td>${p.renovacao_automatica ? 'Automática' : 'Desligada'}${p.renovacoes ? `<small>${p.renovacoes} renovação(ões)</small>` : ''}</td>
        <td class="n">${brl(p.comissao_total)}<small>${esc(p.comissao_percentual)}%</small></td><td>${momentoBR(p.criado_em)}</td></tr>`).join('')
        : '<tr><td colspan="8" class="vazio">Nenhuma proposta encontrada.</td></tr>'}</tbody></table></div>`;
    $('fprop').onsubmit = e => { e.preventDefault(); const d = new FormData(e.target); S.filtrosProp = { busca: d.get('busca').trim(), status: d.get('status') }; abrir('propostas'); };
  }

  /* ---------- Renovações ---------- */
  async function renovacoes() {
    const [venc, exec] = await Promise.all([api('GET', `/api/admin/vencimentos?dias=${S.dias}`), api('GET', '/api/admin/agendamentos')]);
    const renov = exec.filter(e => e.tarefa === 'renovacoes');
    $('conteudo').innerHTML = `<h1>Renovações</h1><p class="sub">A renovação automática roda sozinha todo dia de madrugada e estende por mais 5 anos as apólices que vencem nos próximos 30 dias.</p>
      <div id="rmsg"></div>
      <section class="card"><div class="filtros" style="justify-content:space-between"><h2 style="margin:0">Apólices vencendo</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><label>Período<select id="sdias">${[30, 90, 180, 365].map(d => `<option value="${d}" ${S.dias === d ? 'selected' : ''}>Próximos ${d} dias</option>`).join('')}</select></label>
        <button class="btn sec" id="bproc">Processar renovações agora</button></div></div>
        <div class="tabela"><table><thead><tr><th>Proposta</th><th>Cliente</th><th>Status</th><th>Fim da vigência</th><th class="n">Renovações</th><th>Renovação automática</th></tr></thead>
        <tbody>${venc.length ? venc.map(v => `<tr><td>${esc(v.numero)}</td><td>${esc(v.cliente)}</td><td>${pill(ROT_PROP, v.status)}</td><td>${dataBR(v.vigencia_fim)}</td>
          <td class="n">${esc(v.renovacoes)}</td><td><button class="sw" role="switch" aria-checked="${!!v.renovacao_automatica}" data-renov="${esc(v.numero)}" aria-label="Renovação automática de ${esc(v.numero)}"></button></td></tr>`).join('')
          : `<tr><td colspan="6" class="vazio">Nenhuma apólice vence nos próximos ${S.dias} dias.</td></tr>`}</tbody></table></div></section>
      <section class="card"><h2>Execuções da renovação automática</h2><p class="sub" style="margin-top:-8px">Uma linha por dia, registrada pelo agendador. O botão "Processar renovações agora" mostra o resultado acima e não entra nesta lista.</p>
        <div class="tabela"><table><thead><tr><th>Dia</th><th>Situação</th><th>Início</th><th>Fim</th><th>Resultado</th></tr></thead>
        <tbody>${renov.length ? renov.map(e => `<tr><td>${dataBR(e.data_referencia)}</td><td>${pill(ROT_EXEC, e.status)}</td><td>${momentoBR(e.iniciado_em)}</td><td>${momentoBR(e.concluido_em)}</td>
          <td>${esc(resumoExec(e.resultado))}</td></tr>`).join('') : '<tr><td colspan="5" class="vazio">Nenhuma execução ainda.</td></tr>'}</tbody></table></div></section>`;
    $('sdias').onchange = e => { S.dias = +e.target.value; abrir('renovacoes'); };
    $('bproc').onclick = async e => {
      if (!confirm('Processar agora as renovações das apólices que vencem nos próximos 30 dias?')) return;
      e.target.disabled = true;
      try { const r = await api('POST', '/api/admin/renovacoes/processar', {}); await renovacoes(); $('rmsg').innerHTML = `<div class="msg">Renovação processada: ${esc(resumoExec(r))}.</div>`; }
      catch (err) { e.target.disabled = false; $('rmsg').innerHTML = `<p class="erro">${esc(err.message)}</p>`; }
    };
    $('conteudo').querySelector('tbody').onclick = async e => {
      const b = e.target.closest('[data-renov]'); if (!b) return;
      const ativa = b.getAttribute('aria-checked') !== 'true';
      if (!ativa && !confirm(`Desligar a renovação automática da apólice ${b.dataset.renov}? Ela não será renovada ao fim da vigência.`)) return;
      b.disabled = true;
      try { await api('POST', `/api/admin/propostas/${encodeURIComponent(b.dataset.renov)}/renovacao`, { ativa }); b.setAttribute('aria-checked', String(ativa)); }
      catch (err) { $('rmsg').innerHTML = `<p class="erro">${esc(err.message)}</p>`; }
      finally { b.disabled = false; }
    };
  }
  function resumoExec(r) {
    if (!r) return '—';
    if (r.erro) return 'Erro: ' + r.erro;
    if (!Array.isArray(r.resultado)) return '—';
    if (!r.resultado.length) return 'Nenhuma apólice a renovar';
    const n = {}; r.resultado.forEach(x => { n[x.status] = (n[x.status] || 0) + 1; });
    const nomes = { RENOVADA: 'renovada(s)', NAO_RENOVADA: 'não renovada(s)', ERRO: 'com erro', JA_PROCESSADA: 'já processada(s)' };
    return Object.entries(n).map(([k, v]) => `${v} ${nomes[k] || k}`).join(', ');
  }

  S.token ? telaPainel() : telaLogin();
})();
