# Logística

> Status: **cotação simulada no checkout e registro manual de envio implementados (Etapa 4). Melhor Envio real: Etapa 5.**

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
