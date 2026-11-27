# Roadmap

## Etapa 1 — Planejamento ✅
Arquitetura, stack, estrutura de pastas, modelo de dados e riscos (ver ARQUITETURA.md).

## Etapa 2 — Fundação ✅
- Next.js 16 + TypeScript + Tailwind 4 com tokens de design e identidade provisória (logo + símbolo).
- PostgreSQL + Prisma: schema completo (28 tabelas), migrations, restrições de integridade, seed de catálogo.
- Autenticação: cadastro (com validação, aceite de termos), login, "manter conectado", logout, recuperação/redefinição de senha.
- Perfil: editar nome/telefone/cidade, endereços (CRUD com proteção contra acesso indevido).
- Layout responsivo: navegação inferior no celular (Vender em destaque), cabeçalho no desktop, rodapé.
- Landing page com categorias reais do banco.
- Painel admin protegido com dashboard de contagens reais.
- Políticas provisórias (termos, privacidade, cookies, reembolso, anúncios proibidos) — **sujeitas à revisão jurídica**.
- Segurança base, rate limit, auditoria, logs, validação de ambiente, CI.
- 60 testes (unitários + integração).

## Etapa 3 — Marketplace
Storage (local/Supabase) com validação e reencode de imagens · criar anúncio em etapas (até 8 fotos) · editar/pausar/excluir/reativar ·
moderação opcional · busca full-text + filtros reais + distância · página do produto · favoritos · foto de perfil · anúncios de exemplo (marcados) ·
assistente de anúncio por IA (interface desacoplada, opcional).

## Etapa 4 — Operação comercial
Carrinho (um vendedor por pedido) · reserva temporária com expiração · checkout · pedidos · comissão · painel do vendedor ·
admin completo (usuários, anúncios, pedidos, pagamentos, denúncias, categorias, marcas, cupons, configurações, relatórios) · avaliações.

## Etapa 5 — Integrações
`PaymentProvider` (Mercado Pago Marketplace: OAuth, checkout, split, webhooks, reembolso, chargeback) ·
`ShippingProvider` (Melhor Envio: CEP, cotação, etiqueta, rastreio, cancelamento). Simulação clara em dev.

## Etapa 6 — Finalização
PWA (manifest, service worker, instalação) · SEO (sitemap, metadados, dados estruturados) · monitoramento · CSP com nonce ·
LGPD (exportação/exclusão) · testes E2E · checklist de deploy.

## Futuro (fora do MVP)
Anúncios em destaque pagos, planos para brechós, vitrines patrocinadas, chat comprador–vendedor, apps nativos (reutilizando a API).
