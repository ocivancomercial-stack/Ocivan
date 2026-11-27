# Logística

> Status: **integração Melhor Envio implementada (Etapa 5) e testada contra o simulador ([modelo de teste](MODELO_DE_TESTE.md)). Falta homologar no sandbox oficial.**

## Integração Melhor Envio (`src/services/shipping/melhorenvio.ts`)

Fonte: especificação OpenAPI publicada em docs.melhorenvio.com.br (nov/2026).

| Etapa | Chamada |
|---|---|
| Conta da plataforma | `/oauth/authorize` (escopos `shipping-calculate cart-write shipping-checkout shipping-generate shipping-print shipping-tracking shipping-cancel`) → `POST /oauth/token`. Token 30 dias, refresh 45 dias, renovação automática. Conectado em **Admin › Integrações**. |
| Cotação | `POST /api/v2/me/shipment/calculate` — CEP de origem (endereço do vendedor), CEP de destino, produtos com medidas (cm), peso (kg), valor segurado. Usa `custom_price`/`custom_delivery_time`; descarta serviços com `error`. |
| Etiqueta | `POST /api/v2/me/cart` (remetente/destinatário com CPF, `non_commercial: true` = declaração de conteúdo) → `/shipment/checkout` (saldo da carteira) → `/shipment/generate` → `/shipment/print` (`mode: public`). |
| Rastreio | Webhooks `order.*` com `X-ME-Signature` (HMAC-SHA256 base64 do corpo com o secret do app) + botão "Atualizar rastreio" (`/shipment/tracking`). `posted` → pedido ENVIADO; `delivered` → ENTREGUE. |
| Cancelamento | `POST /api/v2/me/shipment/cancel` (`reason_id: "2"`) automático no reembolso de pedido com etiqueta não postada. |

Medidas padrão por categoria (até o anúncio ter medidas próprias): Roupas 25×5×30, Tênis 22×13×33, Sapatos 20×12×30, Bolsas 30×15×40 cm.
CPF de comprador e vendedor passa a ser exigido para etiquetas (validado, nunca exibido).

**Para homologar:** cadastro no sandbox, aplicativo na Área Dev. com callback `<APP_URL>/api/integrations/melhorenvio/callback`,
webhook `<APP_URL>/api/webhooks/shipping/melhorenvio`, `MELHORENVIO_SANDBOX=1` (saldo fictício de R$ 10.000).

Anteriormente (Etapa 4): cotação simulada e rastreio manual — mantidos para desenvolvimento.

Hoje: `SimulatedShippingProvider` cota "Econômico (simulado)" e "Expresso (simulado)" pela distância entre cidades, além de "Entrega/retirada combinada" (R$ 0) quando o vendedor oferece e o comprador está na RMC. A opção escolhida é **recotada no servidor** ao criar o pedido. O vendedor informa o código de rastreio manualmente; o comprador confirma o recebimento.

## Fornecedor avaliado: Melhor Envio

Agregador com cotação multi-transportadora (Correios, Jadlog, Loggi etc.), geração de etiqueta, rastreio e webhooks; OAuth2 e ambiente sandbox.
Alternativas: Frenet, Kangu, SuperFrete. A decisão final depende de condições comerciais.

## Abstração `ShippingProvider`

`lookupPostalCode(cep)`, `quote({ from, to, package })`, `createLabel(order, serviceId)`, `track(code)`, `cancel(shipmentId)`.

- `SimulatedShippingProvider`: valores fictícios com `isSimulated = true`, etiqueta marcada "SIMULAÇÃO — NÃO É ETIQUETA REAL". Bloqueado em produção.
- `MelhorEnvioProvider`: implementado conforme documentação oficial vigente na Etapa 5.

## Regras

- Origem: CEP do vendedor (nunca exibido ao comprador). Destino: endereço do pedido (snapshot).
- Peso/dimensões padrão por produto (`weightGrams`), ajustáveis.
- Frete somado ao total do pedido e **fora** da base da comissão.

## Credenciais necessárias

Conta Melhor Envio (empresa), aplicação OAuth (client id/secret), token, CEP de origem padrão, saldo/forma de pagamento das etiquetas.
