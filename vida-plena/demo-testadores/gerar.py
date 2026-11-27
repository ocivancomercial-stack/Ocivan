#!/usr/bin/env python3
"""Gera a versão do app para testadores (demo-testadores/index.html) a partir de frontend/index.html.

O que muda em relação ao app:
- tudo roda no aparelho do testador (sem servidor, sem painel técnico de integração);
- nenhuma menção à seguradora parceira nem à comissão;
- aviso de "versão de teste", quadro "Como testar" e tela "Dar opinião" (o testador copia
  a opinião pronta e manda para o corretor por onde preferir).

Uso: python3 demo-testadores/gerar.py   (rodar de dentro de vida-plena/)
Depois, publicar demo-testadores/index.html com a foto frontend/familia.jpg ao lado.
"""
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
s = (RAIZ / 'frontend' / 'index.html').read_text(encoding='utf-8')


def troca(antigo, novo, n=1):
    global s
    achados = s.count(antigo)
    assert achados == n, f'esperava {n}x, achei {achados}x: {antigo[:70]!r}'
    s = s.replace(antigo, novo)


def troca_re(padrao, novo):
    global s
    s, n = re.subn(padrao, novo, s, count=1, flags=re.S)
    assert n == 1, f'padrão não encontrado: {padrao[:70]!r}'


# ---------- cabeçalho: o publicador do artifact monta <html>/<head>/<body> ----------
troca_re(r'<!DOCTYPE html>.*?<title>.*?</title>\n',
         '<title>Vida Plena para Testadores</title>\n'
         '<meta name="claude:viewport-fit-sides" content="cover">\n'
         '<meta name="robots" content="noindex, nofollow">\n')
troca('</style>\n</head>\n<body>\n', '</style>\n')
troca('</script>\n</body>\n</html>', '</script>')

# ---------- estilos ----------
troca('.wrap{max-width:1240px;margin:0 auto;padding:24px max(4vw,12px) 48px;',
      '.wrap{max-width:1240px;margin:0 auto;padding-block:20px 48px;'
      'padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));')
troca('@media(prefers-reduced-motion:reduce)',
      '/* versão para testadores */\n'
      '.faixa{background:var(--bd);color:#fff;font-size:14px;font-weight:600}\n'
      '.faixa div{max-width:1240px;margin:0 auto;padding-block:10px;padding-left:max(16px,env(safe-area-inset-left,0px));'
      'padding-right:max(16px,env(safe-area-inset-right,0px));display:flex;gap:8px 16px;flex-wrap:wrap;align-items:center;justify-content:space-between}\n'
      '.faixa button{min-height:36px;background:#fff;color:var(--bd);border:0;border-radius:99px;padding:0 16px;font-size:14px}\n'
      '.guia{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px 22px}\n'
      '.guia h2{font-size:19px;margin:0 0 10px}.guia ol{margin:0;padding-left:20px;display:grid;gap:8px;font-size:15px}\n'
      '.guia code{font:600 14px/1.4 ui-monospace,Menlo,Consolas,monospace;background:var(--sky);color:var(--bd);padding:1px 6px;border-radius:6px;white-space:nowrap}\n'
      '.guia .cta{margin-top:18px}\n'
      '.notas{display:flex;gap:8px;flex-wrap:wrap}.notas button{flex:1;min-width:48px;font-size:18px}\n'
      'textarea{width:100%;font:inherit;font-size:16px;padding:11px 12px;min-height:92px;border:1.5px solid var(--line);border-radius:12px;background:#f8fbff;color:var(--ink);resize:vertical}\n'
      'textarea:focus{outline:3px solid rgba(10,86,194,.3);outline-offset:1px;border-color:var(--b)}\n'
      'textarea[readonly]{background:var(--sky);min-height:220px;font-size:14px}\n'
      '.sec2{width:100%;margin-top:10px}\n'
      '.ok{color:var(--b);font-weight:700;font-size:14px;min-height:1.4em;margin-top:8px}\n'
      '@media(prefers-reduced-motion:reduce)')

# ---------- faixa de aviso + lateral sem painel técnico ----------
troca('<div class="wrap">\n',
      '<div class="faixa" role="note"><div><span>Versão de teste: os preços são fictícios e nenhum seguro é contratado.</span>'
      '<button type="button" class="abrir-opiniao">Dar opinião</button></div></div>\n<div class="wrap">\n')
troca_re(r'    <details class="dev" open>.*?</details>\n    <p class="foot">.*?</p>\n',
         '    <section class="guia" aria-labelledby="guia-t">\n'
         '      <h2 id="guia-t">Como testar</h2>\n'
         '      <ol>\n'
         '        <li>Faça uma cotação. Os dados de exemplo já vêm preenchidos, mas pode trocar à vontade.</li>\n'
         '        <li>Ligue e desligue coberturas e mexa nos valores para ver o preço mudar.</li>\n'
         '        <li>No pagamento, use o cartão de teste <code>4111 1111 1111 1111</code>, com qualquer validade futura e qualquer CVV. '
         'Para ver um pagamento recusado, use <code>4000 0000 0000 0002</code>.</li>\n'
         '        <li>No fim, toque em "Dar opinião" e mande a mensagem pronta para quem te enviou o link.</li>\n'
         '      </ol>\n'
         '      <p class="foot">Não use um cartão de verdade. Nesta versão nada é cobrado e o que você digita não sai do seu aparelho.</p>\n'
         '      <button type="button" class="cta abrir-opiniao">Dar opinião</button>\n'
         '    </section>\n')

# ---------- integração: só a simulação local, sem registro técnico ----------
troca_re(r'/\* ===== Integração =====.*?(?=/\* ===== Tabela fictícia de preços ===== \*/)',
         '/* ===== Versão para testadores =====\n'
         '   Tudo roda neste aparelho: nada é enviado a servidor algum e nenhum seguro é contratado. */\n'
         'const Seguradora={\n'
         '  wait:ms=>new Promise(r=>setTimeout(r,ms)),\n'
         '  async cotar(req){await this.wait(600);return precificar(req);},\n'
         '  async emitirProposta(req){await this.wait(800);const analise=req.declaracaoSaude.some(Boolean),ini=new Date().toISOString().slice(0,10);\n'
         "    return{numeroProposta:'PRP-'+Date.now().toString().slice(-9),status:analise?'EM_ANALISE_SUBSCRICAO':'ACEITA',periodicidade:req.periodicidade,\n"
         '      vigencia:{inicio:ini,fim:fimVig(),anos:5,renovacaoAutomatica:true}};},\n'
         '  async pagar(req){await this.wait(1000);\n'
         "    if(req.cartaoFinal==='0002')return{status:'RECUSADO',motivo:'Transação não autorizada pelo emissor'};\n"
         "    return{status:'APROVADO',autorizacao:Math.random().toString(36).slice(2,8).toUpperCase(),parcelas:req.parcelas};}\n"
         '};\n\n')
troca_re(r'function logCall\(nome,req,res\)\{.*?finally\{S\.busy=false;\}\}',
         'async function api(_,fn,req){S.busy=true;render(false);\n'
         '  try{return await fn.call(Seguradora,req);}\n'
         "  catch{S.err='Algo deu errado. Tente de novo.';return null;}\n"
         '  finally{S.busy=false;}}')
troca_re(r'    // O número do cartão fica no navegador:.*?logCall\(.Pagamento.*?\n',
         '')
troca("const r=await api('POST /api/pagamentos',Seguradora.pagar,{numeroProposta:S.prop.numeroProposta,tokenCartao,parcelas:S.plano==='anual'?S.parc:1});",
      "const r=await api('pagar',Seguradora.pagar,{cartaoFinal:n.slice(-4),parcelas:S.plano==='anual'?S.parc:1});")
troca_re(r'    // No modo servidor a comissão.*?\n    if\(Seguradora===Simulado\)\{.*?\}\n', '')
troca('render(false);\nconectar();\n', 'render(false);\n')

# ---------- textos das telas ----------
troca_re(r'<div class="note">Demonstração: cartão 4111.*?</div>',
         '<div class="note">Versão de teste: use o cartão <b>4111 1111 1111 1111</b> (aprova) ou <b>4000 0000 0000 0002</b> (recusa), '
         'com qualquer validade futura e qualquer CVV. Não use um cartão de verdade: nada é cobrado e o número não sai do seu aparelho.</div>')
troca('<p class="foot">Dados de exemplo já preenchidos.</p>',
      '<p class="foot">Dados de exemplo já preenchidos. Pode usar assim mesmo.</p>')
troca('<button class="cta" id="restart">Fazer nova cotação</button>`;}',
      '<p class="note">Isto é uma versão de teste: nenhum seguro foi contratado e nada foi cobrado.</p>\n'
      '<button class="cta" id="op-abrir">Dar minha opinião</button>\n'
      '<button class="sec2" id="restart">Fazer nova cotação</button>`;}')

# ---------- tela "Dar opinião" ----------
troca('/* ===== Eventos ===== */',
      r'''/* ===== Opinião do testador =====
   A página não guarda respostas: monta a mensagem para o testador copiar e enviar.
   O rascunho fica só neste aparelho (localStorage), para não se perder ao recarregar. */
const ETAPAS=['Início','Seus dados','Coberturas','Declaração de saúde','Revisão','Pagamento','Contratação concluída'];
const OP_CHAVE='vp_teste_opiniao';
const OP=(()=>{let d={};try{d=JSON.parse(localStorage.getItem(OP_CHAVE)||'{}')||{}}catch{}
  return{aberta:false,nota:+d.nota||0,facil:d.facil||'',gostou:d.gostou||'',melhorar:d.melhorar||'',nome:d.nome||'',texto:'',aviso:''};})();
function opGuardar(){try{localStorage.setItem(OP_CHAVE,JSON.stringify({nota:OP.nota,facil:OP.facil,gostou:OP.gostou,melhorar:OP.melhorar,nome:OP.nome}))}catch{}}
function opTexto(){
  const celular=matchMedia('(max-width: 700px)').matches||/Mobi|Android|iPhone/i.test(navigator.userAgent);
  return ['Opinião sobre o app Vida Plena (versão de teste)','',
    `Nota: ${OP.nota} de 5`,`Fácil de entender: ${OP.facil||'não respondeu'}`,'',
    `O que mais gostei: ${OP.gostou.trim()||'-'}`,'',`O que pode melhorar: ${OP.melhorar.trim()||'-'}`,'',
    `Até onde cheguei: ${ETAPAS[S.step]}${S.pag?' (pagamento aprovado)':''}`,`Plano escolhido: ${S.plano==='anual'?'anual':'mensal'}`,
    `Aparelho: ${celular?'celular':'computador'}`,OP.nome.trim()?`Nome: ${OP.nome.trim()}`:''].filter((l,i,a)=>!(l===''&&a[i-1]==='')).join('\n').trim();}
function telaOpiniao(){
  if(OP.texto)return `<button class="back" id="op-editar">← Editar opinião</button><h1>Sua opinião está pronta</h1>
<p class="sub">Copie a mensagem e envie para quem te mandou o link, pelo WhatsApp ou por e-mail.</p>
<label for="op-texto">Mensagem</label><textarea id="op-texto" readonly>${esc(OP.texto)}</textarea>
<button class="cta" id="op-copiar">Copiar opinião</button><div class="ok" id="op-ok" aria-live="polite">${esc(OP.aviso)}</div>
<button class="sec2" id="op-voltar">Voltar ao app</button>`;
  return `<button class="back" id="op-voltar">← Voltar ao app</button><h1>Dar opinião</h1>
<p class="sub">Leva um minuto e ajuda muito a deixar o app melhor.</p>
<label>Que nota você dá para o app?</label><div class="notas seg" data-op="nota">${[1,2,3,4,5].map(n=>`<button class="${OP.nota===n?'sel':''}" data-v="${n}" aria-label="Nota ${n}">${n}</button>`).join('')}</div>
<label>Foi fácil de entender?</label><div class="seg" data-op="facil">${['Sim','Mais ou menos','Não'].map(t=>`<button class="${OP.facil===t?'sel':''}" data-v="${t}">${t}</button>`).join('')}</div>
<label for="op-gostou">O que você mais gostou?</label><textarea id="op-gostou" maxlength="1000">${esc(OP.gostou)}</textarea>
<label for="op-melhorar">O que podemos melhorar? Algo ficou confuso ou faltou?</label><textarea id="op-melhorar" maxlength="1000">${esc(OP.melhorar)}</textarea>
<label for="op-nome">Seu nome (opcional)</label><input id="op-nome" maxlength="80" value="${esc(OP.nome)}" autocomplete="name">
<div class="err">${esc(OP.aviso)}</div>
<button class="cta" id="op-gerar">Ver mensagem para enviar</button>`;}
function abrirOpiniao(){readDados();OP.aberta=true;OP.texto='';OP.aviso='';render();}
document.addEventListener('click',e=>{const b=e.target.closest('.abrir-opiniao');if(b)abrirOpiniao();});

/* ===== Eventos ===== */''')
troca("function render(anim=true){header();const v=$('view');v.innerHTML=V[S.step]();if(S.step===2)paintCov();",
      "function render(anim=true){header();const v=$('view');v.innerHTML=OP.aberta?telaOpiniao():V[S.step]();if(S.step===2&&!OP.aberta)paintCov();")
troca("  const b=e.target.closest('#view button');if(!b)return;\n  const seg=b.parentElement.classList.contains('seg')?b.parentElement:null;\n",
      "  const b=e.target.closest('#view button');if(!b)return;\n  const seg=b.parentElement.classList.contains('seg')?b.parentElement:null;\n"
      "  if(OP.aberta||b.id==='op-abrir'){\n"
      "    if(b.id==='op-abrir'){abrirOpiniao();return}\n"
      "    if(seg&&seg.dataset.op){OP[seg.dataset.op]=seg.dataset.op==='nota'?+b.dataset.v:b.dataset.v;OP.aviso='';opGuardar();render(false);return}\n"
      "    if(b.id==='op-voltar'){OP.aberta=false;OP.texto='';render();return}\n"
      "    if(b.id==='op-editar'){OP.texto='';OP.aviso='';render();return}\n"
      "    if(b.id==='op-gerar'){if(!OP.nota){OP.aviso='Escolha uma nota de 1 a 5.';return render(false)}OP.texto=opTexto();OP.aviso='';return render()}\n"
      "    if(b.id==='op-copiar'){const t=$('op-texto');\n"
      "      const selecionar=()=>{t.focus();t.select();OP.aviso='Selecione o texto acima e copie.';$('op-ok').textContent=OP.aviso;};\n"
      "      try{navigator.clipboard.writeText(OP.texto).then(()=>{OP.aviso='Copiado! Agora é só colar na conversa e enviar.';$('op-ok').textContent=OP.aviso;},selecionar)}catch{selecionar()}\n"
      "      return}\n"
      "    return}\n")
troca("document.addEventListener('input',e=>{const t=e.target;\n",
      "document.addEventListener('input',e=>{const t=e.target;\n"
      "  if(t.id==='op-gostou'||t.id==='op-melhorar'||t.id==='op-nome'){OP[t.id.slice(3)]=t.value;opGuardar();return}\n")

s = re.sub(r"api\('POST /api/[^']*'", "api('etapa'", s)
troca("  // Na tela de coberturas o preço muda na hora com a tabela local; ao continuar, a cotação oficial vem do servidor.\n", '')

# ---------- conferências ----------
for proibido in ('Tokio', 'tokio', 'COMISSAO', 'comissão', 'logCall', 'Servidor', 'conectar', '/api/', 'npm'):
    assert proibido not in s, f'sobrou "{proibido}" na versão para testadores'

destino = RAIZ / 'demo-testadores' / 'index.html'
destino.write_text(s, encoding='utf-8')
print(f'Gerado {destino.relative_to(RAIZ)} ({len(s.encode()) // 1024} KB)')
