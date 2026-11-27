# Vida Plena: backend

Servidor do app de venda de seguro de vida. Ele recebe os pedidos do app, fala com a seguradora, cobra no cartão e calcula a comissão do corretor.

A integração com a Tokio Marine e a cobrança no cartão estão em **modo simulação** até chegarem as credenciais reais. A cobrança será feita pela plataforma da própria Tokio (`PAYMENTS=tokio`).

## Como rodar

Precisa de Node.js 22.5 ou mais novo. Não há dependências para instalar.

```bash
cp .env.example .env     # ajuste os valores
npm start                # app e API em http://localhost:3000
npm test                 # roda os testes do fluxo completo
```

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
- **Renovação automática.** A rota `POST /api/admin/renovacoes/processar` encontra as apólices que vencem nos próximos 30 dias (`RENOVACAO_ANTECEDENCIA_DIAS`) e pede a renovação à seguradora.
  - Cada renovação estende a vigência por mais 5 anos.
  - O histórico fica guardado na tabela `renovacoes`.
  - Essa rota deve rodar **uma vez por dia**, por um agendador (cron) no servidor.
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
| POST | `/api/admin/renovacoes/processar` | Agendador | Renova as apólices que estão perto do fim da vigência |
| GET | `/api/admin/vencimentos?dias=90` | Você | Lista as apólices que vencem nos próximos dias |
| POST | `/api/admin/propostas/:numero/renovacao` | Você | Liga ou desliga a renovação automática de uma apólice |

- As rotas de admin exigem o cabeçalho `x-admin-token`.
- Os webhooks exigem o cabeçalho `x-webhook-secret`.

## Estrutura

```
src/
  server.js                    servidor HTTP (API, arquivos do app, CORS, limite de corpo, JSON)
  app.js                       rotas e regras do fluxo
  config.js                    configuração, inclusive o percentual de comissão
  db.js                        banco SQLite: clientes, cotações, propostas, pagamentos, comissões
  insurer/tokioMarine.mock.js  seguradora simulada
  insurer/tokioMarine.http.js  esqueleto da API real da Tokio (ajustar à documentação dela)
  payments/index.js            cobrança simulada (mock) e cobrança pela Tokio (tokio)
  services/comissao.js         regras do programa de comissão
  services/validacao.js        validação de CPF, idade, capitais e aceites
test/fluxo.test.js             testes do fluxo inteiro
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
   - Trocar o SQLite por PostgreSQL.
   - Usar HTTPS.
   - Fazer backup diário.
   - Criptografar a declaração de saúde no banco, porque é dado sensível pela LGPD.
4. **Jurídico:**
   - Revisar os textos de aceite e a política de privacidade.
   - Confirmar com a seguradora ou uma assessoria se existe obrigação de informar a comissão ao cliente.
