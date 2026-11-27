# Segurança

## Implementado (Etapa 2)

| Controle | Onde |
|---|---|
| Senhas com hash **scrypt**; nunca em texto puro | Better Auth (`accounts.password`) |
| Política de senha (8–128, letra + número, lista de senhas comuns, sem o e-mail) | `src/schemas/auth.ts`, aplicada também na API |
| Sessões no banco, cookie httpOnly/SameSite=Lax/Secure (prod), revogação no logout e na troca de senha | `src/lib/auth.ts` |
| Bloqueio de login de contas suspensas/excluídas | `databaseHooks.session.create.before` |
| CSRF: verificação de `Origin` ativa em todos os ambientes; Server Actions do Next comparam Origin/Host | `disableOriginCheck: false` |
| Rate limiting persistido (PostgreSQL, atômico): login 5/10min por e-mail, cadastro, recuperação de senha | `src/lib/rate-limit.ts` + Better Auth |
| Anti-enumeração: mensagens genéricas no login e na recuperação de senha | `src/features/auth/actions.ts` |
| Papel não pode ser definido pelo cliente (`input: false`) | `src/lib/auth.ts` |
| Admin: verificação no servidor em layout **e** em cada página; não-admin recebe 404 | `requireAdmin()` |
| IDOR: toda consulta de recurso privado filtra pelo dono | `features/profile/service.ts` (testado) |
| Open redirect bloqueado no `?next=` | `src/lib/safe-redirect.ts` |
| SQL Injection: Prisma parametrizado; SQL bruto apenas com template tags | — |
| XSS: React escapa saída; CSP restritiva; e-mails com escape | `next.config.ts` |
| Cabeçalhos: CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, HSTS (HTTPS) | `next.config.ts` |
| Segredos de terceiros cifrados (AES-256-GCM) | `src/lib/crypto.ts` |
| Trilha de auditoria (cadastro, perfil, reset de senha, promoção a admin) | `audit_logs` |
| Logs estruturados com redação de campos sensíveis | `src/lib/logger.ts` |
| Validação de ambiente: produção recusa simulações e segredos de dev | `src/lib/env.ts` |
| Dados pessoais: endereço nunca público; anúncio mostra só a cidade | design do schema |
| Upload: formato verificado pelo conteúdo (não pela extensão), SVG recusado, limite 8 MB/foto e 8 fotos, mínimo 300px, limite de pixels (anti "bomba de descompressão"), reencode WebP e remoção de EXIF/GPS | `src/services/images/process.ts` |
| Chaves de storage geradas pelo servidor (UUID) e validadas contra path traversal | `src/services/storage` |
| Página pública do produto não expõe e-mail, telefone nem sobrenome do vendedor (testado) | `getProductForPage` |
| Edição/pausa/exclusão filtradas pelo dono; atualização condicional de status contra corrida | `features/products/service.ts` |
| Bloqueio de contato fora da plataforma em anúncios; denúncias com rate limit e sem duplicidade | `schemas/product.ts`, `report-service.ts` |
| Busca: tsquery montada só com letras/dígitos e SQL parametrizado | `features/products/search.ts` |
| Pedidos visíveis só para comprador, vendedor ou admin (404 para os demais — testado) | `getOrderForUser` |
| Endereço do comprador visível ao vendedor apenas enquanto o pedido está pago/em envio | `/pedidos/[id]` |
| Preço, frete e comissão recalculados no servidor; opção de frete inventada é recusada | `createOrderFromCart` |
| Reserva com bloqueio de linha + índice único (compra dupla impossível — testado com concorrência) | `createOrderFromCart` |
| Webhooks: assinatura, idempotência, consulta ao provedor, conferência de valor | `features/payments/service.ts` |
| Rotina de cron protegida por segredo com comparação em tempo constante | `/api/cron/release-reservations` |
| Ações administrativas revalidam ADMIN no servidor e são auditadas; usuário comum recebe 404 (testado) | `features/admin` |

## Próximas etapas

- Webhooks: verificação de assinatura + idempotência (Etapa 5).
- Etapa 6 concluída: CSP com nonce, verificação de e-mail para publicar, LGPD (exportação/exclusão), monitoramento.
- Recomendado antes do lançamento: pentest externo, revisão jurídica, 2FA para administradores, WAF/limite de requisições na borda (Vercel Firewall).

## Relato de vulnerabilidades

Canal provisório: ocivancomercial@gmail.com (trocar pelo e-mail do domínio próprio no lançamento).

## Etapa 6

| Controle | Onde |
|---|---|
| CSP por requisição com **nonce** + `strict-dynamic` (sem `'unsafe-inline'` em scripts); `frame-src`/`frame-ancestors 'none'`, `object-src 'none'` | `src/lib/csp.ts`, `src/proxy.ts` (todas as páginas dinâmicas para receber o nonce) |
| JSON-LD serializado sem permitir `</script>` | `features/seo/structured-data.ts` |
| Publicar anúncio exige e-mail confirmado (anti-spam); link de 24 h | `lib/auth.ts`, `features/products/actions.ts` |
| Exclusão de conta exige senha + confirmação digitada; anonimização e encerramento de sessões | `features/privacy` |
| Exportação de dados sem senha/tokens; registro em `data_requests` | `/api/me/export` |
| Service worker não guarda páginas privadas, API, checkout ou pedidos | `public/sw.js` |
| Erros do servidor em log estruturado + alerta opcional sem dados sensíveis | `src/instrumentation.ts` |
| `robots.txt` bloqueia indexação fora de produção e áreas privadas em produção | `src/app/robots.ts` |

## Integrações (Etapa 5)

- OAuth com `state` + PKCE (Mercado Pago) guardados em cookie httpOnly cifrado de 10 minutos.
- Tokens de vendedores e da plataforma cifrados (AES-256-GCM); renovação automática.
- Webhooks: assinatura verificada em tempo constante, anti-replay (5 min) no Mercado Pago, idempotência por evento.
- Pagamento consultado com o token do vendedor dono; um vendedor não lê pagamentos de outro (testado).
- CPF validado, armazenado só em dígitos, exibido mascarado e enviado apenas à transportadora.
- Simuladores desligados em produção (validação de ambiente + 404).

## IA (assistente de anúncio)

- `ANTHROPIC_API_KEY` só no servidor; nunca exposta ao navegador.
- Fotos enviadas ao provedor apenas quando o vendedor clica em "Sugerir" (reprocessadas, sem EXIF/GPS).
- Texto dentro da imagem tratado como conteúdo, não instrução; saída validada por schema e filtrada contra o catálogo.
- Rate limit por vendedor para conter custo e abuso.
- A política de privacidade deve mencionar o envio opcional de fotos a provedor de IA (pendente de revisão jurídica).
