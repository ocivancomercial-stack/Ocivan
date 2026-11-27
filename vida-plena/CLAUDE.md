# Vida Plena: contexto para o Claude Code

## O projeto
App de venda de **seguro de vida individual 100% digital**: cotação, escolha de coberturas e capitais, declaração de saúde, aceites, pagamento no cartão de crédito e emissão automática.

- **Dono:** Ocivan, corretor de seguros com registro SUSEP. É um projeto pessoal.
- **Seguradora parceira pretendida:** Tokio Marine (produto Vida Individual).
  - A Tokio **não tem API pública**. O acesso está sendo pedido ao comercial.
  - Até chegarem as credenciais, toda a integração roda **simulada**.
- **Idioma:** todo o código, as mensagens e a documentação são em português do Brasil.

## Regras de negócio (não alterar sem pedido explícito)
- **Comissão de corretagem: 30% em todos os casos** (`COMISSAO_PERCENTUAL`).
  - Base de cálculo: prêmio líquido, sem IOF, de cada pagamento aprovado.
  - Gera uma comissão por mensalidade ou por anuidade, inclusive depois das renovações.
  - O percentual é gravado em cada proposta, para não mudar o histórico.
  - Status: PREVISTA → A_RECEBER → RECEBIDA, ou CANCELADA (recusa ou estorno).
  - A proposta é bloqueada se o percentual passar do máximo do produto informado pela seguradora.
  - O cliente nunca vê a comissão.
- **Vigência de 5 anos com renovação automática** (`VIGENCIA_ANOS`).
  - A renovação é processada 30 dias antes do fim e estende a vigência por mais 5 anos.
  - Pode ser desligada por apólice.
- **Idade de aceitação:** 18 a 65 anos.
- **Coberturas:**
  - Morte (obrigatória)
  - Invalidez permanente por acidente
  - Doenças graves
  - Morte acidental
  - Diária por incapacidade temporária
  - Assistência funeral (fixa, R$ 7 mil)
- **IOF:** 0,38%.
- **Desconto anual:** 5%.
- **Tabela de preços:** a do mock é fictícia.

## Segurança (obrigatório)
- O número do cartão **nunca** chega ao servidor: o cartão é tokenizado no navegador pela plataforma de pagamento da Tokio e o servidor recusa números de cartão.
- As credenciais da Tokio ficam só no servidor (`.env`), nunca no front-end.
- A declaração de saúde é dado sensível pela LGPD: é gravada cifrada (AES-256-GCM, `CHAVE_DADOS_SENSIVEIS`, `src/services/cripto.js`). Nunca gravar nem registrar em log em texto puro.
- Webhooks exigem `x-webhook-secret`. Rotas `/api/admin/*` exigem `x-admin-token`.

## Estrutura
```
frontend/index.html   app (HTML único, azul e branco, foto familia.jpg)
                      Servido pelo backend em http://localhost:3000, chama /api/cotacoes, /api/propostas e /api/pagamentos.
                      Sem servidor (arquivo aberto direto ou protótipo publicado), cai na simulação local.
                      A tokenização do cartão ainda é simulada no navegador (gera tok_aprova_XXXX / tok_recusa_0002).
backend/              servidor Node.js 22.5+ (http nativo; única dependência: pg)
  src/server.js       servidor HTTP: API em /api/* e arquivos do frontend/ na mesma origem
  src/app.js          rotas e regras do fluxo
  src/db/             banco: PostgreSQL com DATABASE_URL (produção), senão SQLite (dev e testes); mesma interface assíncrona
                      O SQL usa "?" nos parâmetros e só recursos comuns aos dois bancos (db.mes() para agrupar por mês).
  src/insurer/        tokioMarine.mock.js (simulação) e tokioMarine.http.js (esqueleto da API real; rotas são suposições)
  src/payments/       cobrança simulada (PAYMENTS=mock) e cobrança pela Tokio (PAYMENTS=tokio, usa tokioMarine.http.js)
  src/services/       comissao.js, validacao.js
  test/fluxo.test.js  14 testes do fluxo completo (SQLite e PostgreSQL)
docs/telas/           capturas das telas para apresentação
```

## Comandos
```bash
cd backend
npm install
cp .env.example .env
npm test        # node --test (SQLite em memória)
TEST_DATABASE_URL=postgres://... npm test   # mesmos testes no PostgreSQL (schema temporário)
npm start       # app e API em http://localhost:3000
```
Para ver o app ligado ao servidor, abra http://localhost:3000. Abrindo `frontend/index.html` direto, ele roda em modo simulação.
Para apontar o app para outro servidor: `index.html?api=https://api.exemplo.com.br` (o servidor precisa liberar a origem em `CORS_ORIGIN`).

## Próximas tarefas sugeridas
1. ~~Ligar o front-end ao backend.~~ Feito: o painel de integração mostra as chamadas reais ao servidor.
2. **Cobrança pela plataforma da Tokio Marine** (decisão do corretor: não haverá gateway próprio).
   - Já pronto: `PAYMENTS=tokio` (exige `INSURER=tokio`) chama `cobrar`/`estornar` de `tokioMarine.http.js`. Rotas e campos são suposições.
   - Falta, com a documentação da Tokio: ajustar rotas e campos; trocar `tokenizarCartao()` do `index.html` pelo SDK/checkout da Tokio; ajustar o formato do webhook `/api/webhooks/pagamentos` ao aviso de cobrança da Tokio.
3. ~~Banco de produção.~~ Feito: PostgreSQL com `DATABASE_URL` e declaração de saúde cifrada. Falta só criar o banco gerenciado na publicação (tarefa 6).
4. **Painel administrativo** para o corretor: comissões, vencimentos e renovações.
5. **Integração real com a Tokio**, quando houver documentação: ajustar `tokioMarine.http.js` e usar `INSURER=tokio`.
6. **Publicação:** transformar o front-end em PWA ou app (React Native/Expo), com domínio próprio e HTTPS.

## Pendências com a Tokio Marine
- Acesso à API e ambiente de homologação.
- Cobrança (decidido: pela plataforma da Tokio). Perguntar:
  - como o cartão é tokenizado no app (SDK, iframe ou link de pagamento);
  - se a Tokio cuida da recorrência mensal e do parcelamento anual (até 12x);
  - como avisa cada cobrança aprovada ou recusada (webhook) e se estorna sozinha ao recusar a proposta.
- Limite de corretagem do produto e forma de repasse.
- Regra de renovação: recálculo por idade e índice de reajuste.
- Condições gerais, tabela de preços e regras de subscrição.

## Materiais já feitos (fora do repositório)
- Protótipo publicado: https://claude.ai/artifact/ELE4cHr8NKwtQRrohmzdp1
- Apresentação para a Tokio: https://claude.ai/artifact/A5T32Z5ZZm4mSNaWHMRbRf
