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

## Etapa 3 — Marketplace ✅
- Storage com abstração (`local` em dev, `supabase` em produção); fotos validadas pelo conteúdo real, reencodadas em WebP (máx. 1600px) e **sem EXIF/GPS**; compressão no celular antes do envio.
- Fluxo de venda em 4 etapas (fotos → detalhes → preço → revisão) com até 8 fotos, reordenação e capa; prévia do repasse (comissão 12%).
- Bloqueio de telefone/e-mail/redes sociais em título, descrição e defeitos.
- Meus anúncios: editar, pausar, reativar, excluir, publicar rascunho; estados com máquina de transição testada; moderação `auto`/`manual` configurável.
- Busca full-text em português sem acento e com prefixo (+ marca), filtros reais no banco (categoria, subcategoria, marca, tamanho, estado, preço, cidade, distância aproximada), ordenação e paginação.
- Página do produto: galeria, detalhes, defeitos, vendedor (nome abreviado, cidade, avaliação), semelhantes, favoritar, denunciar.
- Favoritos, vitrine Explorar (perto de você, recentes, destaques, sugestões), landing com produtos reais, foto de perfil.
- Assistente de anúncio por IA com Claude (`claude-opus-5-5`): sugere título, categoria, marca (só com logotipo legível), cor e descrição a partir da foto de capa; o vendedor revisa e escolhe o que aplicar. Ativado com `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.
- 119 testes.
- Pendências conhecidas: botão "Comprar agora" desabilitado até a Etapa 4; fila de moderação no admin (Etapa 4).

### Planejado originalmente para a Etapa 3
Storage (local/Supabase) com validação e reencode de imagens · criar anúncio em etapas (até 8 fotos) · editar/pausar/excluir/reativar ·
moderação opcional · busca full-text + filtros reais + distância · página do produto · favoritos · foto de perfil · anúncios de exemplo (marcados) ·
assistente de anúncio por IA (interface desacoplada, opcional).

## Etapa 4 — Operação comercial ✅
- Carrinho agrupado por vendedor (um pedido por vendedor); bloqueia o próprio anúncio, exemplos e itens indisponíveis.
- Checkout: endereço, frete cotado **no servidor** (provedor simulado), cupom, reserva temporária configurável com `SELECT … FOR UPDATE` + índice único (testado com dois compradores simultâneos).
- Pedidos: código legível (RA-XXXXXX), snapshot de endereço e itens, máquina de estados, cancelamento, envio com rastreio, confirmação de recebimento, disputa, avaliações mútuas.
- Pagamento: `PaymentProvider` + provedor **simulado** com webhook assinado (HMAC) e confirmação consultando o provedor; idempotência por evento; valor divergente nunca libera; pagamento tardio é estornado; chargeback abre disputa.
- Painel do vendedor: anúncios, vendidos, a enviar, pedidos, valor líquido estimado, histórico de transações, avaliações.
- Notificações internas (sininho) e contador do carrinho.
- Admin completo: dashboard, usuários (suspender/reativar), fila de moderação, pedidos (reembolso/disputa), pagamentos e webhooks, denúncias, categorias, marcas, cupons, configurações (comissão, reserva, moderação) com histórico, relatórios (GMV real × simulado).
- Rotina de expiração de reservas (`/api/cron/release-reservations` + `vercel.json`).
- 162 testes.

### Planejado originalmente para a Etapa 4
Carrinho (um vendedor por pedido) · reserva temporária com expiração · checkout · pedidos · comissão · painel do vendedor ·
admin completo (usuários, anúncios, pedidos, pagamentos, denúncias, categorias, marcas, cupons, configurações, relatórios) · avaliações.

## Etapa 5 — Integrações (próxima)
Substituir os provedores simulados por implementações reais atrás das mesmas interfaces (`MercadoPagoProvider`, `MelhorEnvioProvider`), OAuth de vendedores, split, geração de etiqueta e rastreio automático.

`PaymentProvider` (Mercado Pago Marketplace: OAuth, checkout, split, webhooks, reembolso, chargeback) ·
`ShippingProvider` (Melhor Envio: CEP, cotação, etiqueta, rastreio, cancelamento). Simulação clara em dev.

## Etapa 6 — Finalização
PWA (manifest, service worker, instalação) · SEO (sitemap, metadados, dados estruturados) · monitoramento · CSP com nonce ·
LGPD (exportação/exclusão) · testes E2E · checklist de deploy.

## Futuro (fora do MVP)
Anúncios em destaque pagos, planos para brechós, vitrines patrocinadas, chat comprador–vendedor, apps nativos (reutilizando a API).
