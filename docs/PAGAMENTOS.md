# Pagamentos

> Status: **estrutura de dados pronta; integração prevista para a Etapa 5.** Nenhum pagamento é processado hoje.

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
