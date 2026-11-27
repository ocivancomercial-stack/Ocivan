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

## Próximas etapas

- Webhooks: verificação de assinatura + idempotência (Etapa 5).
- CSP com nonce (remover `'unsafe-inline'` de scripts) e verificação de e-mail obrigatória antes de vender (Etapa 6).
- Exclusão de conta/anonimização e exportação de dados (LGPD, Etapa 6).
- Monitoramento de erros (Sentry ou similar) e alertas (Etapa 6).

## Relato de vulnerabilidades

Canal provisório: suporte@repassaai.com.br (a confirmar).
