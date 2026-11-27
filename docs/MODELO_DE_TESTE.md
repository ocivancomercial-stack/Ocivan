# Modelo de teste — integrações reais sem conta

Enquanto não há contas no Mercado Pago e no Melhor Envio, o Repassa Aí roda as **integrações reais**
(`MercadoPagoProvider`, `MelhorEnvioProvider`) contra **simuladores** que imitam as APIs oficiais.
Quando as contas existirem, basta trocar as variáveis — o código de integração é o mesmo.

```
App (código de produção) ──HTTP──► /api/mock/mercadopago/*  (OAuth, preferências, pagamentos, reembolsos)
                         ──HTTP──► /api/mock/melhorenvio/*  (OAuth, cotação, carrinho, compra, geração, impressão, rastreio, cancelamento)
Simuladores ──webhooks assinados──► /api/webhooks/payments/mercadopago  (x-signature HMAC-SHA256)
                                 └► /api/webhooks/shipping/melhorenvio  (X-ME-Signature HMAC-SHA256 base64)
```

## Três modos

| Modo | Configuração | Uso |
|---|---|---|
| Simulado interno | `PAYMENT_PROVIDER=simulated`, `SHIPPING_PROVIDER=simulated` | Desenvolvimento rápido de telas |
| **Modelo de teste** | `.env.test-model.example` (`MOCK_PROVIDERS=1`) | Exercita o código real das integrações sem conta |
| Sandbox oficial | credenciais de teste + `MERCADOPAGO_TEST_MODE=1`, `MELHORENVIO_SANDBOX=1` | Homologação com os provedores |
| Produção | credenciais reais, URLs oficiais | `APP_ENV=production` recusa simuladores, sandbox e URLs não oficiais |

## Como rodar

```bash
cat .env.test-model.example >> .env   # ou copie as linhas manualmente
npm run build && npm start
```

1. **Admin › Integrações › Conectar Melhor Envio** (OAuth no simulador).
2. Vendedor: **Perfil** → CPF e endereço de envio; **Recebimentos › Conectar Mercado Pago** (OAuth + PKCE no simulador).
3. Comprador: compra → checkout cota frete (Correios PAC/SEDEX, Jadlog) → informa CPF → **Pagar** → tela "SIMULADOR — isto NÃO é o Mercado Pago real" → *Pagar (aprovar)*, *Pix pendente* ou *Cartão recusado*.
4. O simulador cria o pagamento e envia o webhook assinado; a plataforma consulta `GET /v1/payments/{id}` e só então marca o pedido como pago.
5. Vendedor: **Gerar etiqueta** (carrinho → compra → geração → impressão). A etiqueta abre marcada "ETIQUETA SIMULADA — NÃO É VÁLIDA".
6. Botões "Simulador: transportadora recebeu a postagem / entregou" disparam os webhooks `order.posted` / `order.delivered`.

## O que os simuladores verificam (como os provedores)

- OAuth: `client_id`/`client_secret`, `redirect_uri` idêntico, código de uso único, **PKCE S256** (Mercado Pago).
- Token obrigatório em todas as chamadas; o vendedor só consulta pagamentos **dele** (403 para outros).
- `X-Idempotency-Key` obrigatório no reembolso; reembolso repetido devolve o mesmo resultado.
- Melhor Envio exige `User-Agent` com e-mail, CPF (`document`) de remetente e destinatário e segue o ciclo `pending → released → generated → posted → delivered` (ou `canceled`).
- Cotação inclui um serviço com erro para garantir que a plataforma o descarte.

## Testes automatizados

`tests/integration/integrations.test.ts` executa os provedores reais contra os simuladores (sem servidor HTTP):
OAuth + PKCE, tokens cifrados, preferência com `marketplace_fee` e total exato, webhook assinado (adulterado,
segredo errado, timestamp antigo, duplicado), Pix pendente e recusa, etiqueta completa com CPF/endereços,
webhooks de transporte, reembolso com idempotência + cancelamento da etiqueta, chargeback e isolamento entre vendedores.

## Limites honestos

- Os simuladores reproduzem os **formatos documentados**, não todas as regras de negócio dos provedores
  (antifraude, limites de dimensão por transportadora, prazos reais, taxas). A homologação no sandbox oficial
  continua necessária antes de produção.
- O comportamento do `marketplace_fee` (como e quando a comissão é repassada) depende da habilitação comercial
  do modelo Marketplace pelo Mercado Pago.
