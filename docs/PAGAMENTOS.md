# Pagamentos

> Status: **fluxo completo implementado com provedor SIMULADO (Etapa 4). Mercado Pago real: Etapa 5.** Nenhum dinheiro real é processado hoje.

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
