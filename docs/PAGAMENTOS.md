# Pagamentos

> Status: **integração Mercado Pago implementada (Etapa 5) e testada contra o simulador ([modelo de teste](MODELO_DE_TESTE.md)). Falta homologar com conta real.**

## Integração Mercado Pago (`src/services/payments/mercadopago.ts`)

Fontes oficiais consultadas em nov/2026: página de Webhooks e de OAuth em mercadopago.com.br/developers e o
código-fonte do SDK oficial `mercadopago` 3.6.2 (endpoints, campos e validação de assinatura).

| Etapa | Chamada |
|---|---|
| Vendedor conecta a conta | `https://auth.mercadopago.com/authorization?client_id&response_type=code&platform_id=mp&state&redirect_uri&code_challenge&code_challenge_method=S256` → `POST /oauth/token` (`grant_type=authorization_code`, `code_verifier`; `test_token` em teste). Tokens cifrados em `seller_payment_accounts`; renovação com `grant_type=refresh_token` (token vale 180 dias). |
| Pagamento | `POST /checkout/preferences/` com o **token do vendedor**: `items` (produtos + frete), `external_reference` = id do pedido, `marketplace_fee` = comissão, `notification_url`, `back_urls`, `auto_return`, `expires`/`expiration_date_to` = prazo da reserva, `X-Idempotency-Key`. O comprador vai para `init_point` (`sandbox_init_point` em teste). |
| Confirmação | Webhook → valida `x-signature` (`ts=…,v1=…`; HMAC-SHA256 de `id:{data.id};request-id:{x-request-id};ts:{ts};` com a assinatura secreta; tolerância 5 min) → `GET /v1/payments/{id}` com o token do vendedor (identificado pelo `user_id` do webhook). |
| Reembolso | `POST /v1/payments/{id}/refunds` (corpo vazio = total) com `X-Idempotency-Key`. |
| Status | `pending`/`in_process` → PENDING · `authorized` · `approved` · `in_mediation` · `rejected` · `cancelled` · `refunded` · `charged_back`. |

**Para homologar:** criar a aplicação em "Suas integrações", cadastrar a Redirect URL
(`<APP_URL>/api/integrations/mercadopago/callback`), configurar Webhooks (tópico *Pagamentos*,
URL `<APP_URL>/api/webhooks/payments/mercadopago`), copiar a assinatura secreta, gerar usuários de teste
(vendedor e comprador), solicitar a habilitação do modelo Marketplace (split via `marketplace_fee`).

Anteriormente (Etapa 4): fluxo completo com provedor SIMULADO interno, mantido para desenvolvimento rápido.

## Fluxo implementado

```
Checkout → pedido PENDING_PAYMENT (peças RESERVED, prazo = reservation_minutes)
  → "Pagar" → PaymentProvider.createCheckout()  (real: redireciona; simulado: painel de testes)
  → provedor envia webhook → /api/webhooks/payments/[provider]
      1. verifyWebhook()  — assinatura (simulado: HMAC-SHA256)
      2. webhook_events (provider, eventKey) único → duplicado = ignorado
      3. getPayment()     — CONSULTA O PROVEDOR (fonte da verdade)
      4. confere pedido e VALOR; aprovado → PAID, peças SOLD, notificações
```

| Situação no provedor | Efeito |
|---|---|
| PENDING / AUTHORIZED / IN_MEDIATION | Registrado; pedido continua aguardando |
| APPROVED (valor correto) | Pedido pago; reserva convertida; peças vendidas |
| APPROVED com valor diferente | Ignorado + auditoria (`payment.amount_mismatch`) |
| APPROVED após expiração | Estorno automático (`payment.late_auto_refund`) |
| REJECTED / CANCELED | Pedido segue pendente até expirar (comprador pode tentar de novo) |
| CHARGED_BACK | Pedido vai para DISPUTED |
| Cancelamento após pago (antes do envio) | `refund()` no provedor → REFUNDED; peça volta a ATIVA |

O painel "PAGAMENTO SIMULADO" só existe com `APP_ENV ≠ production`; os botões mudam o estado no provedor simulado (`simulated_payments`) e disparam o mesmo pipeline do webhook.

## Princípios (inegociáveis)

1. Um pedido só vira `PAID` quando o **servidor** confirma o pagamento consultando o provedor (`GET` do pagamento após webhook).
2. Retorno do navegador ("sucesso") ou comprovante enviado pelo usuário **nunca** confirmam pagamento.
3. Webhooks com **assinatura verificada** e registrados em `webhook_events` com `@@unique([provider, eventKey])` → reprocessar o mesmo evento não duplica nada.
4. Nenhum dado de cartão passa pelos nossos servidores (checkout do provedor).
5. Modo simulado: só com `APP_ENV ≠ production`, sempre marcado `isSimulated = true` e exibido como "SIMULADO".

## Abstração

`PaymentProvider` (Etapa 5): `createCheckout(order)`, `getPayment(id)`, `verifyWebhook(req)`, `refund(paymentId, amount?)`,
`connectSellerUrl()` / `exchangeOAuthCode()`. Implementações: `SimulatedPaymentProvider` e `MercadoPagoProvider`.

## Mercado Pago Marketplace — o que será necessário

| Item | Observação |
|---|---|
| Conta Mercado Pago da empresa + aplicação no painel de desenvolvedores | Gera Public Key, Access Token, Client ID/Secret |
| Modelo Marketplace (OAuth) aprovado | Vendedores conectam a conta; o split usa `marketplace_fee` |
| Chave secreta de webhook | Validação do cabeçalho `x-signature` |
| Contas de teste (comprador/vendedor) | Homologação |

A implementação seguirá a **documentação oficial vigente** no momento da Etapa 5 (endpoints e parâmetros serão conferidos lá, não supostos aqui).

## Comissão

`platform_settings.platform_fee_bps` (padrão 1200 = 12%) aplicada sobre o **subtotal dos produtos** (não sobre o frete).
Exemplo: R$ 100 → comissão R$ 12 → R$ 88 ao vendedor **antes** das taxas do provedor. O valor efetivamente repassado é o informado pelo provedor.
A comissão aplicada fica gravada no pedido (`platformFeeBps`) — alterar a configuração não muda pedidos antigos.
