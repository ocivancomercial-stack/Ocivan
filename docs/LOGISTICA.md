# Logística

> Status: **estrutura de dados pronta (`shipments`, `shipment_events`); integração prevista para a Etapa 5.**

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
