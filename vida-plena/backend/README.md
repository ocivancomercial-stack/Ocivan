# Vida Plena: backend

Servidor do app de venda de seguro de vida. Ele recebe os pedidos do app, fala com a seguradora, cobra no cartão e calcula a comissão do corretor.

A integração com a Tokio Marine e a cobrança no cartão estão em **modo simulação** até chegarem as credenciais reais. A cobrança será feita pela plataforma da própria Tokio (`PAYMENTS=tokio`).

## Como rodar

Precisa de Node.js 22.5 ou mais novo.

```bash
npm install              # instala o driver do PostgreSQL (pg)
cp .env.example .env     # ajuste os valores
npm start                # app e API em http://localhost:3000
npm test                 # roda os testes do fluxo completo (SQLite em memória)
```

## Painel do corretor

Abra http://localhost:3000/admin e entre com o `ADMIN_TOKEN` do `.env`.

- **Resumo:** comissões a receber, recebidas, previstas e canceladas, gráfico por mês, vencimentos e a última renovação automática.
- **Comissões:** filtros por status e data, botão "Marcar recebida" e exportação para planilha (CSV no formato do Excel em português).
- **Propostas:** busca por nome, número ou parte do CPF. O CPF aparece mascarado e a declaração de saúde nunca é mostrada.
- **Renovações:** apólices vencendo, liga e desliga da renovação automática, botão para processar na hora e histórico do agendador.
- **Segurança:**
  - O token fica só na aba do navegador e some ao fechá-la.
  - A página tem política de segurança rígida (CSP): só roda o próprio script e só fala com a própria API.
  - Todo texto vindo de clientes é exibido como texto, sem executar.
  - No CSV, nomes que começam com `=`, `+`, `-` ou `@` são neutralizados para a planilha não executar fórmulas.

## Banco de dados

- **Desenvolvimento:** sem `DATABASE_URL`, o servidor usa SQLite no arquivo `DB_PATH`. Não precisa instalar nada.
- **Produção:** com `DATABASE_URL`, usa PostgreSQL. As tabelas são criadas na subida do servidor (`src/db/schema.postgres.sql`).
  - Com `NODE_ENV=production`, o servidor só sobe com PostgreSQL e com a chave de criptografia.
  - Valores em dinheiro ficam em `NUMERIC(12,2)`, datas da apólice em `DATE` e horários em UTC.
- **Testes no PostgreSQL:** `TEST_DATABASE_URL=postgres://... npm test`. Os testes usam um schema temporário, apagado no fim; os dados existentes não são tocados.
- O código usa uma interface única (`src/db/index.js`), então as rotas não mudam de um banco para o outro.

## Declaração de saúde (LGPD)

- É gravada **criptografada** (AES-256-GCM) com a chave `CHAVE_DADOS_SENSIVEIS`, que fica só no servidor.
- Cada declaração fica presa à sua proposta: copiar o valor cifrado para outra proposta ou alterá-lo faz a leitura falhar.
- **Guarde uma cópia da chave em local seguro.** Sem ela, as declarações gravadas não podem ser lidas.
- Em desenvolvimento sem chave, a declaração é gravada em texto puro, com um aviso na subida. Para cifrar essas declarações depois: `npm run db:cifrar`.

O servidor também serve o app (`../frontend`, ou a pasta em `FRONTEND_DIR`) na mesma origem da API, então não é preciso configurar CORS. Abra http://localhost:3000 e faça uma contratação: as chamadas aparecem no painel "Integração com a seguradora".

## Programa de comissão

- **30% em todos os casos.** O valor fica em `COMISSAO_PERCENTUAL` no `.env`.
- **Base de cálculo:** o prêmio líquido, sem IOF, de cada pagamento aprovado.
  - No plano mensal, cada mensalidade paga gera uma comissão.
  - No plano anual, a comissão é calculada uma vez, sobre o prêmio anual.
- **O percentual fica gravado em cada proposta.** Se o valor mudar no futuro, o histórico continua igual.
- **Status da comissão:**

| Status | Quando acontece |
|---|---|
| `PREVISTA` | Pagamento aprovado, mas a proposta ainda está em análise na seguradora |
| `A_RECEBER` | Proposta aceita ou apólice emitida; falta a seguradora fazer o repasse |
| `RECEBIDA` | O admin conferiu o repasse e marcou como recebida |
| `CANCELADA` | Proposta recusada ou pagamento estornado |

- **Trava de segurança:** se a seguradora informar um limite de corretagem menor que 30% para o produto, a proposta é bloqueada e o motivo aparece na resposta.
- **O cliente nunca vê a comissão** nas respostas da API.

Exemplo: com prêmio mensal líquido de R$ 34,07, a comissão é de R$ 10,22 por mês.

## Vigência e renovação automática

- **Vigência de 5 anos.** Começa na data da proposta e o valor fica em `VIGENCIA_ANOS` no `.env`. Uma data de 29/02 vira 28/02 quando o ano final não é bissexto.
- **Renovação automática.** Todo dia, o servidor encontra as apólices que vencem nos próximos 30 dias (`RENOVACAO_ANTECEDENCIA_DIAS`) e pede a renovação à seguradora.
  - Cada renovação estende a vigência por mais 5 anos.
  - O histórico fica guardado na tabela `renovacoes`.
- **Agendador** (`src/agendador.js`): já vem ligado no servidor, sem precisar de cron.
  - Roda uma vez por dia, a partir das 3h de Brasília (`RENOVACAO_HORA`, `FUSO_HORARIO`). Se o servidor estava desligado nesse horário, roda assim que voltar.
  - Com vários servidores no ar, só um executa cada dia: o dia é reservado na tabela `agendamentos`.
  - Se a execução falhar, é tentada de novo depois de 15 minutos. Se um servidor cair no meio, outro assume depois de 1 hora.
  - Uma apólice que deu erro na seguradora é tentada de novo no dia seguinte, enquanto estiver dentro dos 30 dias.
  - A vigência nunca é estendida duas vezes, mesmo se a rota manual e o agendador rodarem juntos.
  - Histórico das execuções: `GET /api/admin/agendamentos`. Para desligar: `AGENDADOR_ATIVO=false`.
- As datas (início da vigência, dia da renovação) seguem o fuso de Brasília, e não o horário UTC do servidor.
- **Cliente que não quer renovar:** desligue a renovação pela rota `POST /api/admin/propostas/:numero/renovacao` com `{ "ativa": false }`.
- **Se a seguradora recusar a renovação:** a renovação automática daquela apólice é desligada e o motivo fica registrado.
- **Cobranças durante a vigência:**
  - No plano mensal, a Tokio cobra todo mês.
  - No plano anual, a Tokio cobra uma vez por ano.
  - Cada cobrança aprovada chega pelo webhook de pagamentos e gera uma comissão de 30%, inclusive depois das renovações.

## Rotas

| Método | Rota | Quem usa | O que faz |
|---|---|---|---|
| GET | `/api/saude` | — | Mostra o status, a seguradora e o meio de cobrança ativos (sem a comissão) |
| POST | `/api/cotacoes` | App | Calcula o preço das coberturas escolhidas |
| POST | `/api/propostas` | App | Envia a proposta, com dados, declaração de saúde e aceites |
| GET | `/api/propostas/:numero` | App | Consulta o status da proposta ou da apólice |
| POST | `/api/pagamentos` | App | Cobra no cartão a partir de um **token** do cartão |
| POST | `/api/webhooks/seguradora` | Tokio | Recebe aceite, recusa (com estorno automático) ou emissão da apólice |
| POST | `/api/webhooks/pagamentos` | Tokio | Registra cada cobrança recorrente (mensal ou anual) e gera a comissão dela |
| GET | `/api/admin/comissoes?status=&de=&ate=` | Você | Lista as comissões |
| GET | `/api/admin/comissoes/resumo` | Você | Totais por status e por mês |
| POST | `/api/admin/comissoes/:id/recebida` | Você | Marca uma comissão como recebida |
| POST | `/api/admin/renovacoes/processar` | Você | Roda a renovação na hora (o agendador já faz isso todo dia) |
| GET | `/api/admin/agendamentos` | Você | Histórico das execuções diárias do agendador |
| GET | `/api/admin/vencimentos?dias=90` | Você | Lista as apólices que vencem nos próximos dias |
| GET | `/api/admin/propostas?status=&busca=` | Você | Lista as propostas (CPF mascarado, sem declaração de saúde) |
| POST | `/api/admin/propostas/:numero/renovacao` | Você | Liga ou desliga a renovação automática de uma apólice |

- As rotas de admin exigem o cabeçalho `x-admin-token`.
- Os webhooks exigem o cabeçalho `x-webhook-secret`.

## Estrutura

```
src/
  server.js                    servidor HTTP (API, arquivos do app, CORS, limite de corpo, JSON)
  app.js                       rotas e regras do fluxo
  config.js                    configuração, inclusive o percentual de comissão
  db/index.js                  escolhe o banco (PostgreSQL com DATABASE_URL, senão SQLite) e define a interface
  db/postgres.js               PostgreSQL (produção)
  db/schema.postgres.sql       tabelas do PostgreSQL
  db/sqlite.js                 SQLite (desenvolvimento e testes), com as tabelas
  agendador.js                 tarefas diárias (renovação automática), uma vez por dia mesmo com vários servidores
  services/cripto.js           criptografia da declaração de saúde
  services/datas.js            datas no fuso de Brasília
  insurer/tokioMarine.mock.js  seguradora simulada
  insurer/tokioMarine.http.js  esqueleto da API real da Tokio (ajustar à documentação dela)
  payments/index.js            cobrança simulada (mock) e cobrança pela Tokio (tokio)
  services/comissao.js         regras do programa de comissão
  services/validacao.js        validação de CPF, idade, capitais e aceites
test/fluxo.test.js             testes do fluxo inteiro
scripts/cifrar-declaracoes.js  cifra declarações antigas gravadas em texto puro (npm run db:cifrar)
```

## Cartão de crédito

- O app **nunca** envia o número do cartão para este servidor.
- O cartão é tokenizado no navegador pela plataforma de pagamento da Tokio, e o servidor recebe só o token.
- Se alguém mandar um número de cartão no lugar do token, a requisição é recusada.
- Tokens de teste da simulação:
  - `tok_aprova_4111`: aprova o pagamento
  - `tok_recusa_0002`: recusa o pagamento

## Para ir para produção

1. **Tokio Marine:** com a documentação e as credenciais em mãos, ajustar `tokioMarine.http.js` e usar `INSURER=tokio`.
   - Confirmar o limite de corretagem do Vida Individual e se 30% é aceito.
   - Confirmar se o repasse da comissão é feito por mensalidade.
   - Confirmar como a renovação é feita na API deles (rota, se o prêmio é recalculado pela idade e por qual índice ele é reajustado).
2. **Cobrança pela Tokio:** ajustar `cobrar` e `estornar` em `tokioMarine.http.js` à documentação dela e usar `PAYMENTS=tokio` (junto com `INSURER=tokio`).
3. **Banco e infraestrutura:**
   - Criar o banco PostgreSQL gerenciado (com SSL) e definir `DATABASE_URL`, `CHAVE_DADOS_SENSIVEIS` e `NODE_ENV=production`.
   - Usar HTTPS.
   - Fazer backup diário do banco e guardar a chave de criptografia separada do backup.
4. **Jurídico:**
   - Revisar os textos de aceite e a política de privacidade.
   - Confirmar com a seguradora ou uma assessoria se existe obrigação de informar a comissão ao cliente.
